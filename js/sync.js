// Синхронизация сохранения с сервером (этап «А»): локальная копия всегда есть, на сервер уходит с задержкой.
// Ревизии защищают от затирания: если с другого устройства сохранение новее, игрок выбирает, какое оставить.
const SYNC_KEY = 'ash_sync_v2';
// slot: основная игра и тестовая версия (dev, локально) хранят разные сохранения
const syncSlot = () => isTestBuild() ? 'dev' : 'main';   // тестовая версия хранит сохранение в отдельном слоте (env.js)
let sync = { rev: 0, dirty: false, busy: false, timer: null, tried: false, pending: null, ops: [] };
try { Object.assign(sync, JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'), { busy: false, timer: null, tried: false }); } catch (e) {}
// Экономия вызовов сервера: отправка не чаще раза в SYNC_DELAY мс, пустые изменения не отправляем (сравнение по хэшу), при сворачивании — сразу.
let SYNC_DELAY = 20000;
let lastSent = '';
const saveSync = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ rev: sync.rev, dirty: sync.dirty, pending: sync.pending, ops: sync.ops })); } catch (e) {} };

// Действия с экономикой (js/ops.js) уже применены на телефоне; в очередь они идут, чтобы сервер повторил их у себя (пачкой, вместе с сохранением)
function queueOp(op) { if (!serverOn()) return; sync.ops.push(op); markDirty(); }
function markDirty() { if (!serverOn()) return; sync.dirty = true; saveSync(); scheduleSync(); }
function scheduleSync() { if (sync.timer) return; sync.timer = setTimeout(() => { sync.timer = null; serverPush(); }, SYNC_DELAY); }
function flushSync() { if (serverOn() && sync.dirty) { clearTimeout(sync.timer); sync.timer = null; serverPush(true); } }

// При запуске: выбрать между локальным и серверным сохранением. lv — локальная строка, r — ответ сервера на load.
function resolveSave(lv, r) {
  if (r.status !== 200) return lv;                       // нет связи — играем локально, догоним позже
  const s = r.save;
  if (!s) { if (lv) { sync.dirty = true; saveSync(); scheduleSync(); } return lv; }   // на сервере пусто: загрузим локальное
  if (!lv) { sync.rev = s.rev; sync.dirty = false; saveSync(); return JSON.stringify(s.data); }
  if (sync.rev === s.rev) return lv;                     // локальное основано на последнем серверном
  if (s.rev > sync.rev && !sync.dirty) { sync.rev = s.rev; saveSync(); return JSON.stringify(s.data); }   // сервер новее, у нас нет несохранённого
  let local = {}; try { local = JSON.parse(lv); } catch (e) {}
  const takeServer = confirm(`Найдено сохранение с другого устройства (уровень ${s.data.lvl}, у этого устройства уровень ${local.lvl ?? '?'}).\n\nOK — загрузить сохранение с сервера.\nОтмена — оставить сохранение этого устройства (серверное будет перезаписано).`);
  if (takeServer) { sync.rev = s.rev; sync.dirty = false; saveSync(); return JSON.stringify(s.data); }
  sync.rev = s.rev; sync.dirty = true; saveSync(); scheduleSync(); return lv;
}

// Сервер — хозяин уровня, опыта, выносливости, здоровья и боя (js/guard.js): после каждого ответа он присылает st, и мы накладываем это на героя.
// stateGen растёт при начале и конце боя: устаревший ответ (отправленный до этого) поверх свежего состояния не накладывается.
let stateGen = 0;
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
function applyServerState(st, gen) {
  if (!st || !S || inFight || sync.ops.length || (gen !== undefined && gen !== stateGen)) return;
  Object.assign(S, st); store.set(JSON.stringify(S));
  if (typeof hud === 'function') hud();
}
// Конфликт ревизий: игрок выбирает, чьё сохранение оставить. true — загружено серверное (экран перезапущен).
function resolveConflict(r) {
  const takeServer = confirm(`Сохранение изменилось на другом устройстве (уровень ${r.save.data.lvl}).\n\nOK — загрузить его.\nОтмена — оставить это и перезаписать серверное.`);
  sync.pending = null;
  if (takeServer) {
    sync.ops = []; sync.rev = r.save.rev; sync.dirty = false; saveSync();
    S = r.save.data; store.set(JSON.stringify(S)); go(S.scene || 'guild_hall'); return true;
  }
  sync.rev = r.save.rev; sync.dirty = true; sync.forced = true; saveSync(); return false;
}
// Окончание боя ушло не сразу (нет связи) — повторяем, пока сервер не примет. Вызывать только под блокировкой sync.busy.
async function flushPending(gen, keepalive) {
  const p = sync.pending; if (!p) return true;
  const r = await serverCall('combat_end', { data: p.data, choices: p.choices, ops: p.ops || [], baseRev: sync.rev }, keepalive);
  if (r.status === 200 && r.ok) { sync.rev = r.rev; sync.pending = null; sync.dirty = false; saveSync(); applyServerState(r.st, gen); return true; }
  if (r.status === 200 && (r.error === 'no_combat' || r.error === 'bad_data')) { sync.pending = null; saveSync(); return true; }   // бой уже закрыт сервером
  if (r.status === 409 && r.save) { resolveConflict(r); return false; }
  return false;
}
async function lockSync() { while (sync.busy) await sleepMs(80); sync.busy = true; }

// Если серверная функция в Supabase старее этой версии игры (или новее), её проверки не совпадут с игрой и действия будут откатываться.
// Админу показываем заметное предупреждение: нужно вставить свежий supabase/functions/agina/index.ts и нажать Deploy.
let buildWarned = false;
function checkBuild(r) {
  if (buildWarned || !r || r.status !== 200 || typeof SERVER_BUILD === 'undefined' || r.build === SERVER_BUILD) return;
  if (!(typeof isAdmin === 'function' && isAdmin())) return;
  buildWarned = true;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99;padding:10px 12px;border-radius:12px;background:#b3412f;color:#fff;font:13px/1.35 system-ui;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  d.textContent = 'Админу: серверная функция устарела (' + (r.build || 'старая версия') + ', нужна ' + SERVER_BUILD + '). Вставьте новый supabase/functions/agina/index.ts в Supabase и нажмите Deploy, иначе новые действия будут откатываться. Нажмите, чтобы скрыть.';
  d.onclick = () => d.remove(); document.body.appendChild(d);
}
async function serverPush(keepalive) {
  if (!serverOn() || !S || sync.busy) return;
  sync.busy = true;
  let again = false;
  try {
    const gen = stateGen;
    if (!(await flushPending(gen, keepalive))) return;
    const payload = JSON.stringify(S);
    if (payload === lastSent && !sync.forced && !sync.ops.length) { sync.dirty = false; saveSync(); return; }   // ничего не изменилось
    const n = sync.ops.length;
    const r = await serverCall('save', { data: S, baseRev: sync.rev, ops: sync.ops.slice(0, n) }, keepalive);
    checkBuild(r);
    if (r.status === 200 && r.ok) { sync.ops.splice(0, n); sync.rev = r.rev; sync.dirty = false; sync.forced = false; lastSent = payload; saveSync(); applyServerState(r.st, gen); return; }
    if (r.status === 409 && r.save) { if (!resolveConflict(r)) again = true; return; }
    if (r.error === 'no_player' && !sync.tried) {          // старый герой без профиля на сервере: пробуем зарегистрировать его ник
      sync.tried = true;
      const g = await serverCall('register', { nick: S.name, gender: S.gender || 'n', birth: S.birth || null });
      if (g.status === 200 && g.ok) again = true;
    }
  } finally { sync.busy = false; }
  if (again) serverPush();
}

// Начало боя на сервере: он списывает выносливость и выдаёт seed. Результат: {ok:true, seed} или {ok:false, error, wait}.
async function serverCombatStart(id, mode) {
  if (!serverOn()) return { ok: true };
  for (let tryN = 0; tryN < 2; tryN++) {
    await lockSync();
    let r;
    try {
      if (!(await flushPending())) return { ok: false, error: 'network' };
      stateGen++;
      const n = sync.ops.length;
      r = await serverCall('combat_start', { id, mode: mode || null, data: S, baseRev: sync.rev, ops: sync.ops.slice(0, n) });
      if (r.status === 200 && r.ok) { sync.ops.splice(0, n); sync.rev = r.rev; sync.dirty = false; Object.assign(S, r.st); lastSent = JSON.stringify(S); store.set(lastSent); saveSync(); return { ok: true, seed: r.seed }; }
    } finally { sync.busy = false; }
    if (r.status === 409 && r.save) { if (resolveConflict(r)) return { ok: false, error: 'reloaded' }; continue; }
    if (r.status === 200 && r.error === 'stam') return { ok: false, error: 'stam', wait: r.wait };
    return { ok: false, error: r.status === 0 ? 'network' : (r.error || 'server') };
  }
  return { ok: false, error: 'conflict' };
}
// Конец боя: на сервер уходят выборы игрока и состояние до награды; награду он считает сам. Экран не ждёт ответа.
async function serverCombatEnd(pre, choices) {
  if (!serverOn()) return;
  stateGen++;
  sync.pending = { data: pre, choices, ops: sync.ops.splice(0) }; sync.dirty = true; saveSync();
  const gen = stateGen;
  await lockSync();
  try { await flushPending(gen); } finally { sync.busy = false; }
  if (sync.pending) scheduleSync();   // не дошло — повторим позже
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSync(); });
window.addEventListener('pagehide', flushSync);

// Крафт и готовка: шанс бросает сервер, поэтому это единственные действия, которые ждут ответа. Без связи не работают.
async function serverCraft(id, opName = 'craft') {
  await lockSync();
  try {
    if (!(await flushPending())) return { ok: false, msg: 'Нет связи с сервером. Крафт требует связи.' };
    const n = sync.ops.length;
    const r = await serverCall('save', { data: S, baseRev: sync.rev, ops: [...sync.ops, { op: opName, id }] });
    if (r.status === 200 && r.ok) {
      sync.ops.splice(0, n); sync.rev = r.rev; sync.dirty = false; Object.assign(S, r.st); lastSent = JSON.stringify(S); store.set(lastSent); saveSync();
      return r.res && r.res.ok ? { ok: true, res: r.res.res } : { ok: false, msg: opName === 'cook' ? 'Не вышло: не хватает продуктов.' : 'Не вышло: не хватает материалов.' };
    }
    if (r.status === 409 && r.save) { resolveConflict(r); return { ok: false, msg: 'Сохранение изменилось на другом устройстве.' }; }
    return { ok: false, msg: r.status === 0 ? 'Нет связи с сервером. Крафт требует связи.' : 'Сервер не принял действие.' };
  } finally { sync.busy = false; }
}
