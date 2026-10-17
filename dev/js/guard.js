// СТОРОЖ СЕРВЕРА: что игрок может менять в сохранении сам, а что решает только сервер.
// Чистый код (без DOM и без обращений к базе): используется серверной функцией «agina» и проверяется тестами на телефоне/в браузере.
// Не подключается в index.html — игре на телефоне он не нужен.
//
// Под защитой сервера (клиент их менять не может): уровень, опыт, победы/поражения, ловец, база характеристик, класс,
// выносливость, здоровье (только вниз или в пределах естественного восстановления), текущий бой,
// а с этапа Б2 ещё инвентарь с монетами, экипировка, питомцы и флаги заданий. Их меняют только действия (js/ops.js),
// которые сервер повторяет над своим состоянием; выбранный титул — тоже (действие settitle). Админ проверяется как обычный игрок:
// его инструменты — действия admin_*, которые сервер принимает только по секрету ADMIN_IDS. Имя, пол и дата рождения берутся из профиля игрока (таблица players) при первом сохранении и дальше не меняются. Клиентское: сцена и прочее неважное.
const GUARD_KEYS = ['lvl', 'xp', 'wins', 'losses', 'trapper', 'base', 'cls', 'stam', 'stamAt', 'inv', 'equip', 'pets', 'pet', 'petSeq', 'flags', 'title', 'name', 'gender', 'birth', 'daily', 'escortDone', 'buff', 'kills', 'captures'];
const MAX_OPS = 300;
const FIRST_SAVE_MAX_LVL = 5;          // первое сохранение принимается очищенным (sanitizeNew), уровень не выше этого
const COMBAT_MS_MIN = 700;             // быстрее раунд сыграть нельзя (в игре — секунда анимации)
const COMBAT_TTL = 3600000;            // бой старше часа считается брошенным
const MAX_ROUNDS = 300;
const clone = (o) => JSON.parse(JSON.stringify(o));

// То, что сервер отдаёт клиенту после каждого действия: клиент накладывает это поверх своего состояния
function protectedState(s) {
  const o = {};
  [...GUARD_KEYS, 'hp', 'hpAt', 'hpFrac'].forEach((k) => { if (s[k] !== undefined) o[k] = clone(s[k]); });
  return o;
}
const inCombat = (stored, now) => !!(stored && stored.combat && now - stored.combat.t0 < COMBAT_TTL);

// Первое сохранение героя: принимается, но очищается — известные предметы (не больше 99), известные флаги, разумные монеты и ловец.
const KNOWN_FLAGS = ['contract', 'gear', 'recipe', 'cage_gift', 'cloak_made', 'captured', 'm3gear', 'm3', 'knight_met', 'knight_task', 'belt_given', 'slayer1', 'slayer2', 'slayer3', 'slayer4'];
function sanitizeNew(out) {
  out.base = out.base || {}; if (out.base.luck == null) out.base.luck = 1; if ((out.base.stamina || 0) < 50) out.base.stamina = 50;
  if (!(out.lvl >= 1)) out.lvl = 1;
  if (out.lvl > FIRST_SAVE_MAX_LVL) { out.lvl = FIRST_SAVE_MAX_LVL; out.xp = 0; }
  out.xp = Math.max(0, Number(out.xp) || 0); out.wins = Math.min(500, Math.max(0, out.wins | 0)); out.losses = Math.min(500, Math.max(0, out.losses | 0));
  const inv = {}; Object.keys(out.inv || {}).forEach((k) => { if (ITEMS[k]) inv[k] = Math.min(99, Math.max(0, Math.floor(Number(out.inv[k]) || 0))); });
  out.inv = inv; if (coins(out) > 5000) setCoins(out, 5000);
  const eq = {}, used = {}; Object.keys(out.equip || {}).forEach((k) => { const id = out.equip[k]; if (SLOTS[k] && id && ITEMS[id] && ITEMS[id].slot === slotType(k) && (used[id] || 0) < (inv[id] || 0)) { eq[k] = id; used[id] = (used[id] || 0) + 1; } });   // одну вещь в двух слотах не носят
  out.equip = eq;
  const fl = {}; KNOWN_FLAGS.forEach((k) => { if (out.flags && out.flags[k]) fl[k] = 1; }); out.flags = fl;
  out.pets = (out.pets || []).filter((p) => ENEMIES[p.species] && RANKS.includes(p.rank)).slice(0, 20).map((p) => ({ id: p.id | 0, species: p.species, rank: p.rank, dead: !!p.dead, ...(p.dead && Number(p.reviveAt) > 0 ? { reviveAt: Number(p.reviveAt) } : {}) }));
  if (!out.pets.some((p) => p.id === out.pet)) out.pet = null;
  out.daily = {}; out.escortDone = 0;
  out.petSeq = Math.max(out.petSeq | 0, ...out.pets.map((p) => p.id), 0);
  const tr = out.trapper || {}; out.trapper = { lvl: Math.min(3, Math.max(0, tr.lvl | 0)), prog: Math.max(0, Number(tr.prog) || 0) };
  if (out.title && !(TITLES[out.title] && TITLES[out.title].has(out))) out.title = null;
  out.hp = Math.min(Math.max(0, Number(out.hp) || 0), maxHp(out));
  return out;
}

// stored — то, что лежит на сервере (null — первое сохранение), incoming — присланное клиентом. Админ проверяется так же, как игрок:
// его возможности — отдельные действия admin_* (js/ops.js), которые сервер выполняет только по секрету ADMIN_IDS.
function guardMerge(stored, incoming, now) {
  const out = clone(incoming);
  delete out.combat;
  if (!stored) { const n = sanitizeNew(out); giveBelt(n); return n; }
  GUARD_KEYS.forEach((k) => { if (stored[k] === undefined) delete out[k]; else out[k] = clone(stored[k]); });
  // здоровье: только естественное восстановление от сохранённого значения (зелья лечат через действие use)
  const t = { ...out, hp: stored.hp, hpAt: stored.hpAt, hpFrac: stored.hpFrac };
  regenHpAt(t, now, inCombat(stored, now));
  out.hp = Math.max(0, Math.min(Number(incoming.hp) || 0, t.hp, maxHp(t)));
  out.hpAt = t.hpAt; out.hpFrac = t.hpFrac;
  giveBelt(out);   // миграция: пояс всем, кто уже получил снаряжение аколита
  if (stored.combat) out.combat = stored.combat;
  return out;
}

// Присланные клиентом действия повторяются над состоянием сервера по порядку; невозможные пропускаются.
// seedBase — случайное число сервера: от него берутся seed для крафта (клиент подобрать удачный не может).
function applyOps(s, ops, seedBase, admin, now) {
  let last = null;
  (Array.isArray(ops) ? ops : []).slice(0, MAX_OPS).forEach((op, i) => {
    if (!op || typeof op.op !== 'string') return;
    op = { ...op, seed: (seedBase + Math.imul(i + 1, 2654435761)) >>> 0 };
    last = applyOp(s, op, { admin: !!admin, now });
  });
  return last;
}
// Общий вход: сторож + действия
function prepare(stored, incoming, ops, now, admin, seedBase) {
  const s = guardMerge(stored, incoming, now);
  const last = applyOps(s, ops, seedBase, admin, now);
  return { s, last };
}
// Обычное сохранение с действиями
function saveOnly(stored, incoming, ops, now, admin, seedBase) {
  const { s, last } = prepare(stored, incoming, ops, now, admin, seedBase);
  return { ok: true, data: s, res: last };
}

// Начало боя: проверяем выносливость, списываем её и запоминаем снимок героя + seed. Возвращает {ok, data, seed} или {ok:false, error}.
function combatStart(stored, incoming, id, now, admin, seed, ops, mode) {
  if (!ENEMIES[id]) return { ok: false, error: 'bad_enemy' };
  const s = prepare(stored, incoming, ops, now, admin, seed).s;
  let queue = [];
  if (mode === 'escort') {   // задание сопровождения: только если взято и ещё не начато; враги определяются сервером по уровню
    if (dailyState(s, now) !== 'taken') return { ok: false, error: 'locked' };
    const foes = escortFoes(s); id = foes[0]; queue = foes.slice(1);
    s.daily.escortSt = 'fight';
  } else if (FIGHT_REQ[id] && !FIGHT_REQ[id](s)) return { ok: false, error: 'locked' };
  regenHpAt(s, now, false);
  if (stam(s, now) < STAM_COST) return { ok: false, error: 'stam', wait: stamWaitMin(s, STAM_COST, now) };
  spendStam(s, STAM_COST, now);
  s.hpAt = now; s.hpFrac = 0;
  s.combat = { id, seed: seed >>> 0, t0: now, snap: heroSnap(s, now), mode: mode || null, queue };
  return { ok: true, data: s, seed: s.combat.seed };
}

const cleanChoice = (c, admin) => ({
  potion: !!(c && c.potion),
  restore: !!(admin && c && c.restore),
  atk: ZK.includes(c && c.atk) ? c.atk : null, def: ZK.includes(c && c.def) ? c.def : null,
  capture: !!(c && c.capture), retreat: !!(c && c.retreat), timedOut: !!(c && c.timedOut),
});
// Конец боя: сервер сам проигрывает бой по seed и выборам, награды считает он. Выигрыш, объявленный клиентом, не принимается.
function combatEnd(stored, incoming, choices, now, admin, ops, seedBase) {
  const cb = stored && stored.combat;
  if (!cb) return { ok: false, error: 'no_combat' };
  const s = prepare(stored, incoming, ops, now, admin, seedBase).s;
  const ch = (Array.isArray(choices) ? choices : []).slice(0, MAX_ROUNDS).map((c) => cleanChoice(c, admin));
  const rp = replayCombat(cb.snap, cb.id, cb.seed, ch, { queue: cb.queue || [], mode: cb.mode || null, noCapture: cb.mode === 'escort' });
  const tooFast = now - cb.t0 < ch.length * COMBAT_MS_MIN;
  const outcome = tooFast || now - cb.t0 > COMBAT_TTL ? 'fled' : rp.outcome;
  const res = applyOutcome(s, rp.h, rp.C, outcome, rp.R, now);
  s.hpAt = now; s.hpFrac = 0;
  delete s.combat;
  return { ok: true, data: s, outcome, tooFast };
}
