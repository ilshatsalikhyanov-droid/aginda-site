// ЯДРО ИГРЫ: чистая логика без экранов (формулы, бой, награды, питомцы). Работает и на телефоне, и на сервере.
// Правило: здесь нельзя обращаться к DOM, window, tg, Date без параметра now и к Math.random (только сидированный RNG).
// Данные (ENEMIES, ITEMS, DROPS, SLOTS …) берутся из соседних файлов.

// ---- Сидированный генератор случайных чисел (mulberry32): один seed → одна и та же последовательность ----
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngInt = (R, a, b) => a + Math.floor(R() * (b - a + 1));
const rngPick = (R, arr) => arr[Math.floor(R() * arr.length)];
// В середине фразы имя с маленькой буквы; имена собственные («Крысиная Матка») не трогаем
const low = (s) => (/\s[А-ЯЁ]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const plural = (n, a, b, c) => { const m = n % 100, d = n % 10; return m > 10 && m < 20 ? c : d === 1 ? a : d > 1 && d < 5 ? b : c; };

// Значок предмета для текста (диалоги, лог, шапка): картинка, если есть, иначе эмодзи. Общий для игры и сервера (награды сцен).
const iconHtml = (it) => (it.img ? `<img class="iic" src="${pic(it.img)}" alt="">` : it.icon);
const coinIcon = () => iconHtml(ITEMS.bronze_coin);
// ---- Монеты: бронза → серебро → золото по 100 к 1; coins() — всё в бронзе, цены в бронзе ----
const coins = (s) => (s.inv.bronze_coin || 0) + 100 * (s.inv.silver_coin || 0) + 10000 * (s.inv.gold_coin || 0);
function setCoins(s, total) {
  total = Math.max(0, Math.floor(total));
  s.inv.bronze_coin = total % 100; s.inv.silver_coin = Math.floor(total / 100) % 100; s.inv.gold_coin = Math.floor(total / 10000);
}
const addCoins = (s, n) => setCoins(s, coins(s) + n);
const spend = (s, n) => setCoins(s, coins(s) - n);

// ---- Экипировка и слоты ----
const slotType = (k) => SLOT_TYPE[k] || k;
const slotsFor = (type) => Object.keys(SLOTS).filter((k) => slotType(k) === type);
const equippedCount = (s, id) => Object.values(s.equip).filter((v) => v === id).length;
function equipItem(s, id, key) {
  const ks = slotsFor(ITEMS[id].slot);
  const k = key || ks.find((x) => !s.equip[x]) || ks[0];
  s.equip[k] = id;
}
const itemActive = (s, it) => !it || ((!it.minLvl || s.lvl >= it.minLvl) && (!it.path || it.path === s.path));   // вещи с minLvl выше уровня героя и вещи чужого пути не действуют
function equipped(s) { return Object.values(s.equip).filter(Boolean).map((id) => ITEMS[id]).filter((it) => itemActive(s, it)); }
// Комплекты путей (SETS в equipment.js): бонусы за 2, 4 и 7 вещей одного комплекта складываются по достигнутым ступеням.
const setCount = (s, id) => equipped(s).filter((i) => i && i.set === id).length;
function setBonus(s, stat) {
  let v = 0; const seen = {};
  equipped(s).forEach((i) => { if (i && i.set && !seen[i.set] && SETS[i.set]) { seen[i.set] = 1; const n = setCount(s, i.set); Object.keys(SETS[i.set].bonus).forEach((th) => { if (n >= +th) v += SETS[i.set].bonus[th][stat] || 0; }); } });
  return v;
}
const cageOf = (s) => { const c = s.equip && ITEMS[s.equip.cage]; return c && itemActive(s, c) ? c : null; };
function autoEquip(s, id) {
  const it = ITEMS[id]; if (!it.slot || !itemActive(s, it)) return;
  const free = slotsFor(it.slot).find((k) => !s.equip[k]); if (free) s.equip[free] = id;
}

// ---- Характеристики: голые здоровье, сила, ловкость, разум умножаются на 1,5 с каждым уровнем ----
const LEVEL_MUL = 1.5;
const bareStat = (s, stat) => { const b = s.base[stat] || 0; return ['hp', 'str', 'agi', 'int'].includes(stat) ? Math.round(b * Math.pow(LEVEL_MUL, s.lvl - 1)) : b; };
function total(s, stat) {
  let v = bareStat(s, stat);
  equipped(s).forEach((i) => v += i.bonus?.[stat] || 0); return v + setBonus(s, stat);
}
const pathPct = (s, k) => { const p = pathOf(s); return (p && p[k]) || 0; };   // процентная прибавка пути героя (см. PATHS в data.js)
const maxHp = (s) => Math.round((bareStat(s, 'hp') + equipped(s).reduce((a, i) => a + (i.bonus?.hp || 0), 0) + setBonus(s, 'hp') + titleBonus(s, 'hp')) * (1 + (pathPct(s, 'hp') + setBonus(s, 'hpPct')) / 100));
const maxStam = (s) => (s.base.stamina || 50) + equipped(s).reduce((a, i) => a + (i.bonus?.stamina || 0), 0);

// ---- Выносливость и здоровье: восстановление считается по времени (now — мс), в том числе пока игра закрыта ----
function stam(s, now = Date.now()) {
  const mx = maxStam(s);
  if (s.stam == null) { s.stam = mx; s.stamAt = now; }
  if (s.stam >= mx) { s.stam = mx; s.stamAt = now; return s.stam; }
  const k = Math.floor((now - s.stamAt) / STAM_REGEN_MS);
  if (k > 0) { s.stam = Math.min(mx, s.stam + k); s.stamAt += k * STAM_REGEN_MS; if (s.stam >= mx) s.stamAt = now; }
  return s.stam;
}
function spendStam(s, n, now = Date.now()) { stam(s, now); s.stam -= n; }
function stamWaitMin(s, n, now = Date.now()) {   // минут ждать, чтобы набрать n очков выносливости
  stam(s, now);
  const ms = (n - s.stam) * STAM_REGEN_MS - (now - s.stamAt);
  return Math.max(1, Math.ceil(ms / 60000));
}
const HP_REGEN_PCT_PER_MIN = 5;   // 5% от максимума в минуту вне боя
function regenHpAt(s, now = Date.now(), inFight = false) {
  const mx = maxHp(s);
  if (s.hpAt == null) s.hpAt = now;
  const dt = now - s.hpAt; s.hpAt = now;
  if (inFight || s.hp >= mx) { s.hpFrac = 0; return; }
  s.hpFrac = (s.hpFrac || 0) + mx * HP_REGEN_PCT_PER_MIN / 100 * dt / 60000;
  const k = Math.floor(s.hpFrac);
  if (k > 0) { s.hp = Math.min(mx, s.hp + k); s.hpFrac -= k; }
}

// ---- Опыт и награды ----
const xpNeed = (s) => s.lvl === 1 ? XP_LEVEL2 : s.lvl === 2 ? XP_LEVEL3 : s.lvl === 3 ? XP_LEVEL4 : s.lvl === 4 ? XP_LEVEL5 : s.lvl === 5 ? XP_LEVEL6 : Math.round(XP_LEVEL7 * Math.pow(XP_GROWTH_NEED, s.lvl - 6));
function addXp(s, x) {
  const out = x > 0 ? [`+${Math.round(x * 10) / 10} опыта`] : []; s.xp += x;
  while (s.xp >= xpNeed(s)) { s.xp -= xpNeed(s); s.lvl++; s.hp = maxHp(s); out.push(`⭐ Уровень ${s.lvl}!`); }
  return out;
}
function gain(s, g) {
  const out = [];
  if (g.gold) { addCoins(s, g.gold); out.push(`+${g.gold} ${coinIcon()}`); }
  if (g.item) { s.inv[g.item] = (s.inv[g.item] || 0) + 1; out.push(`${iconHtml(ITEMS[g.item])} ${ITEMS[g.item].name}`); autoEquip(s, g.item); }
  if (g.hp) { s.hp = Math.min(maxHp(s), s.hp + g.hp); }
  if (g.xp) { out.push(...addXp(s, g.xp)); }
  return out;
}

// ---- Питомцы, ранги, навык «Ловец монстров» ----
const RANKS = ['D', 'C', 'B', 'A'];
const RANK_F = { D: 1 / 2, C: 2 / 3, B: 5 / 6, A: 1 };   // доля характеристик монстра по рангу
const petName = (p) => `${ENEMIES[p.species].name} [${p.rank}]`;
// Сила питомца = доля ранга от характеристик его вида ДЛЯ УРОВНЯ ГЕРОЯ lvl (питомцы растут вместе с автолевелингом монстров:
// питомец ранга D на 6 уровне ровно вдвое слабее монстра своего вида 6 уровня).
const petBonusPct = (s) => (pathOf(s) && pathOf(s).pet) ? Math.min(pathOf(s).petMax, Math.round(pathOf(s).petBase + bareStat(s, 'int'))) + equipped(s).reduce((a, i) => a + (i.bonus?.pet || 0), 0) + setBonus(s, 'pet') : 0;   // Укротитель: питомец сильнее (путь, вещи, комплект)
function petStats(p, lvl, bonus = 0) {
  const m = enemyFor(p.species, lvl), f = RANK_F[p.rank], k = 1 + bonus / 100;
  return { hp: Math.max(1, Math.round(m.hp * f * k)), dmg: Math.max(1, Math.round((m.petDmg != null ? m.petDmg : m.dmg) * f * k)), def: Math.round(m.def * f), crit: m.crit * f, dodge: m.dodge * f };
}
const curPet = (s) => (s.pets || []).find((p) => p.id === s.pet);
function addPet(s, species, rank = 'D') {
  s.pets = s.pets || []; const p = { id: (s.petSeq = (s.petSeq || 0) + 1), species, rank, dead: false };
  s.pets.push(p); if (!curPet(s)) s.pet = p.id; return p;
}
const trapNeed = (n) => 10 * Math.pow(2, n);          // поимок до следующего уровня ловца: 10, 20, 40…
const trapper = (s) => s.trapper || (s.trapper = { lvl: 0, prog: 0 });
function captureChance(s, e) {
  const cage = cageOf(s); if (!cage || !cage.capture) return null;
  const lv = e.baseLevel || e.level;   // шанс поимки считается по базовому уровню вида (автолевелинг не закрывает поимку крыс и троллей-детёнышей)
  const row = cage.capture.base.find((r) => lv >= r.from && lv <= r.to); if (!row) return 0;
  let c = row.chance;
  if (e.cur < e.hp * 0.2) c += 10;                     // здоровье зверя ниже 20%
  c += trapper(s).lvl;                                 // +1% за уровень ловца
  c += titleBonus(s, 'capture');                       // титул «Ловец»
  return Math.min(90, c);                              // потолок 90%
}
function enrage(e) { e.enraged = true; e.dmg *= 1.5; e.def *= 1.5; e.crit *= 1.5; e.dodge *= 1.5; }   // макс. здоровье не растёт

// ---- Автолевелинг: монстры с scale:true растут вместе с героем (характеристики по таблице SCALING, откалиброванной симуляцией:
// процент побед (с рекомендованным питомцем, если он нужен) остаётся тем, что задан у монстра). Питомцы растут так же — см. petStats.
// fixed:true (крысы): награды не растут — опыт и монеты как на базовом уровне, правило «слабого монстра» считается от базового уровня.
function enemyFor(id, lvl) {
  const b = ENEMIES[id];
  if (!b.scale || !(lvl > b.level)) return b;
  const L = Math.min(lvl, LEVEL_CAP_SCALING), row = (SCALING[id] || {})[L];
  const d = L - b.level;
  const r = row || { hp: b.hp * Math.pow(1.5, d), dmg: b.dmg * Math.pow(1.5, d), def: b.def * Math.pow(1.5, d) };
  // pow (этап 2): с 5-го уровня монстр бьёт сильнее в pow раз, а питомец его вида берёт силу от dmg строки без множителя (иначе питомцы росли бы вместе с этим множителем)
  return { ...b, ...r, dmg: r.dmg * (r.pow || 1), petDmg: r.dmg, level: lvl, baseLevel: b.level, rewardLevel: b.fixed ? b.level : lvl, xp: b.fixed ? b.xp : Math.round(b.xp * Math.pow(XP_GROWTH_MOB, lvl - b.level)) };
}
const rewardLvl = (e) => e.rewardLevel != null ? e.rewardLevel : e.level;   // уровень, от которого считаются награды монстра
const healAmount = (s, id) => Math.round(maxHp(s) * ITEMS[id].use.healPct / 100);

// ---- Пояс: слоты под вспомогательные предметы (зелья). Предмет в слот встаёт сам, как только он есть в сумке ----
const auxSlots = (s) => { const b = s.equip && ITEMS[s.equip.belt]; return b && b.slots ? b.slots : 0; };
function auxList(s) {   // что лежит в слотах пояса: по одной штуке на слот
  const n = auxSlots(s), out = [];
  Object.keys(ITEMS).filter((id) => ITEMS[id].aux).sort((a, b) => ITEMS[b].use.healPct - ITEMS[a].use.healPct).forEach((id) => { for (let i = 0; i < ((s.inv && s.inv[id]) || 0) && out.length < n; i++) out.push(id); });
  return out;
}
// Тряпичный пояс получают все, кто уже получил снаряжение аколита (наставник на 2-м уровне); для старых героев — один раз автоматически
function giveBelt(s) {
  if (!(s.flags && s.flags.gear) || s.flags.belt_given) return false;
  s.flags.belt_given = 1; s.inv.belt_rag = (s.inv.belt_rag || 0) + 1; if (!s.equip.belt) s.equip.belt = 'belt_rag'; return true;
}

// ---- Бой: зоны удара и защиты ----
const ZONES = { head: { label: 'Голова', acc: 'голову' }, body: { label: 'Корпус', acc: 'корпус' }, legs: { label: 'Ноги', acc: 'ноги' } };
const ZK = Object.keys(ZONES);
const pc = (s) => `<span class="pc">${s}</span>`;   // строки питомца в логе
const ld = (s) => `<span class="ld">${s}</span>`;   // служебные строки лога

// Еда (харчевня): s.buff = {pct, until} — на pct% выше урон, защита, крит и уклонение, пока не наступит until (реальное время).
const buffPct = (s, now) => (s.buff && s.buff.until > now ? s.buff.pct : 0);
// Снимок героя для боя (на сервере воспроизведение идёт только по нему): всё, что влияет на бой. Бонус еды фиксируется на начало боя.
function heroSnap(s, now) {
  return JSON.parse(JSON.stringify({ lvl: s.lvl, base: s.base, equip: s.equip, hp: s.hp, trapper: trapper(s), pets: s.pets || [], pet: s.pet, inv: Object.fromEntries(Object.keys(ITEMS).filter((id) => ITEMS[id].aux).map((id) => [id, (s.inv && s.inv[id]) || 0])), flags: {}, path: s.path || null, buffPct: buffPct(s, now || 0), tb: { hp: titleBonus(s, 'hp'), capture: titleBonus(s, 'capture'), dmgPct: titleBonus(s, 'dmgPct') } }));
}

// Новый бой: состояние боя целиком сериализуемо (без ссылок на экран).
// opts: {queue: [id…] — враги, ждущие своей очереди (бьёт всегда первый живой), mode: 'escort' — задание сопровождения, noCapture — клеть выключена}
function newCombat(s, id, opts = {}) {
  const e = enemyFor(id, s.lvl);
  const pp = curPet(s), pet = pp && !pp.dead ? { pid: pp.id, species: pp.species, rank: pp.rank, ...petStats(pp, s.lvl, petBonusPct(s)) } : null;
  if (pet) pet.cur = pet.hp;
  const queue = (opts.queue || []).slice();
  return { id, lvl: s.lvl, buff: s.buffPct != null ? s.buffPct : buffPct(s, opts.now || 0), dmgPct: titleBonus(s, 'dmgPct'), pDmg: 1 + (pathPct(s, 'dmg') + setBonus(s, 'dmgPct')) / 100, pTaken: 1 + (pathPct(s, 'taken') + setBonus(s, 'taken')) / 100, critMul: (pathOf(s) && pathOf(s).critMul) || 1.5, e: { ...e, cur: e.hp }, pet, round: 0, captureUsed: false, petRetreat: false, over: null, queue, total: 1 + queue.length, kills: [], aux: auxList(s), usedPotions: 0, usedIds: [], mode: opts.mode || null, noCapture: !!opts.noCapture || (!!e.boss && !(cageOf(s) && cageOf(s).bossOk)) || (e.cageTier || 1) > ((cageOf(s) && cageOf(s).tier) || 0),   // босса (кроме Прочной клети) и монстра, которого клеть не удержит, поймать нельзя
    log: [`Бой начался. Против вас — ${low(e.name)}${queue.length ? (queue.length === 1 ? ' (и ещё один ждёт своей очереди)' : ' (и ещё ' + queue.length + ' ждут своей очереди)') : ''}.`] };
}

// Враг повержен: если за ним ждёт следующий, он выходит вперёд (раунд на этом заканчивается), иначе победа.
function enemyDown(C) {
  C.kills.push(C.id);
  if (!C.queue.length) { C.over = 'win'; return; }
  const prev = C.e, nid = C.queue.shift(), ne = enemyFor(nid, C.lvl);
  C.id = nid; C.e = { ...ne, cur: ne.hp }; C.captureUsed = false; C.advanced = true;
  C.log.push(`<b>${prev.name} повержен${prev.gender === 'f' ? 'а' : prev.gender === 'n' ? 'о' : ''}.</b> Следом выходит ${low(ne.name)}.`);
}

// Админ: восстановить здоровье героя и питомца прямо в бою (питомец возвращается в бой, если погиб).
function combatRestore(C, h) {
  h.hp = maxHp(h);
  const pp = curPet(h);
  if (pp) { pp.dead = false; const st = petStats(pp, h.lvl, petBonusPct(h)); C.pet = { pid: pp.id, species: pp.species, rank: pp.rank, ...st, cur: st.hp }; C.petRetreat = false; }
}

// Один раунд боя. C — бой, h — герой (s на телефоне, снимок на сервере), ch — выбор игрока, R — генератор.
// ch: {atk, def, capture, retreat, timedOut}. По завершении C.over = 'win' | 'capture' | 'lose'.
function combatRound(C, h, ch, R) {
  if (ch.restore) combatRestore(C, h);   // только админ: сервер принимает этот признак от админа
  const e = C.e, Z = ZONES, za = ch.atk || null, ea = rngPick(R, ZK), ed = rngPick(R, ZK);
  const cap = !!ch.capture && !C.captureUsed && !C.noCapture, pet = C.pet, retreat = !!(ch.retreat && pet);
  const bm = 1 + (C.buff || 0) / 100;   // еда: урон, защита, крит и уклонение героя
  let zd = ch.def || null, note = '';
  if (!zd) { zd = rngPick(R, ZK); note = ` Защита выбрана наугад: ${Z[zd].label.toLowerCase()}.`; }
  C.round++; C.log.push(`<b>Раунд ${C.round}</b>${ch.timedOut ? ' · время вышло.' : ''}${note}`);
  C.log.push(ld(`Ваш выбор: ${cap ? 'клеть-ловушка' : za ? 'удар — ' + Z[za].label.toLowerCase() : 'без удара'}, блок — ${Z[zd].label.toLowerCase()}.`));
  C.log.push(ld(`${e.name}: удар — ${Z[ea].label.toLowerCase()}, блок — ${Z[ed].label.toLowerCase()}.`));
  // зелье из слота пояса: пьётся в начале хода, удар и блок остаются; слот не пополняется до конца боя
  if (ch.potion) {
    if (C.aux.length && h.hp < maxHp(h)) {
      const pid = C.aux.shift(); C.usedPotions++; C.usedIds.push(pid);
      const heal = Math.min(healAmount(h, pid), maxHp(h) - h.hp); h.hp += heal;
      C.log.push(`🧪 Вы выпиваете ${low(ITEMS[pid].name)}: <span class="good">+${heal}</span>.`);
    }
  }
  // 1. герой: клеть заменяет удар
  if (cap) {
    C.captureUsed = true; const chn = captureChance(h, e);
    C.log.push(`🪤 Вы используете клеть-ловушку (шанс ${chn}%).`);
    if (rngInt(R, 1, 100) <= chn) { C.over = 'capture'; return; }
    enrage(e); C.log.push('<b>Противник увернулся от клети. Кажется, вы его разозлили ещё больше.</b>');
  } else if (!za) C.log.push('Вы не успели нанести удар.');
  else if (ed === za) C.log.push(`Вы бьёте в ${Z[za].acc}, но ${low(e.name)} закрывается.`);
  else if (rngInt(R, 1, 100) <= e.dodge) C.log.push(`Вы бьёте в ${Z[za].acc}, но ${low(e.name)} уворачивается.`);
  else {
    let d = (total(h, 'str') + total(h, 'dmg')) * bm * (1 + (C.dmgPct || 0) / 100) * (C.pDmg || 1) + rngInt(R, 0, 2) - e.def, cr = '';   // dmgPct — титул «Крысобой»
    if (rngInt(R, 1, 100) <= Math.min(60, (total(h, 'agi') + total(h, 'crit')) * bm)) { d = d * (C.critMul || 1.5); cr = ' <b>Крит!</b>'; }
    d = Math.max(1, Math.round(d)); e.cur -= d;
    C.log.push(`Вы бьёте в ${Z[za].acc}: <span class="good">−${d}</span>${cr}`);
  }
  if (e.cur <= 0) { enemyDown(C); return; }
  // 2. питомец: удар и блок наугад
  const pz = rngPick(R, ZK), pb = rngPick(R, ZK);
  if (retreat) C.log.push(pc('Питомец отступает с поля боя.'));
  else if (pet) {
    let line = `Питомец бьёт в ${Z[pz].acc}`;
    if (ed === pz) line += `, но ${low(e.name)} закрывается`;
    else if (rngInt(R, 1, 100) <= e.dodge) line += `, но ${low(e.name)} уворачивается`;
    else {
      let d = pet.dmg + rngInt(R, 0, 1) - e.def, cr = '';
      if (rngInt(R, 1, 100) <= pet.crit) { d = d * 1.5; cr = ' Крит!'; }
      d = Math.max(1, Math.round(d)); e.cur -= d; line += `: −${d}${cr}`;
    }
    C.log.push(pc(`${line}. Блок: ${Z[pb].label.toLowerCase()}.`));
    if (e.cur <= 0) { enemyDown(C); return; }
  }
  // 3. противник: урон делится пополам между героем и питомцем (до блока и уклонения)
  let D = e.dmg + rngInt(R, -1, 2), cr = '';
  if (rngInt(R, 1, 100) <= e.crit) { D = D * 1.5; cr = ' <b>Крит!</b>'; }
  const share = pet ? 0.5 : 1;
  if (zd === ea) C.log.push(`${e.name} бьёт в ${Z[ea].acc}, но вы успеваете закрыться.`);
  else if (rngInt(R, 1, 100) <= Math.min(40, (total(h, 'agi') + total(h, 'dodge')) * bm)) C.log.push(`${e.name} бьёт в ${Z[ea].acc}, но вы уворачиваетесь.`);
  else {
    const d = Math.max(1, Math.round(D * share * (C.pTaken || 1) - total(h, 'def') * bm)); h.hp -= d;
    C.log.push(`${e.name} бьёт в ${Z[ea].acc}: <span class="bad">−${d}</span>${cr}`);
  }
  if (pet) {
    if (pb === ea) C.log.push(pc('Питомец закрывается от удара.'));
    else if (rngInt(R, 1, 100) <= pet.dodge) C.log.push(pc('Питомец уворачивается.'));
    else {
      const d = Math.max(1, Math.round(D * 0.5) - pet.def); pet.cur -= d;
      C.log.push(pc(`Удар по питомцу: −${d}`));
      if (pet.cur <= 0) {
        const pp = (h.pets || []).find((p) => p.id === pet.pid); if (pp) pp.dead = true;
        C.pet = null; C.log.push(pc('<b>Питомец погиб.</b>'));
      }
    }
    if (retreat) C.pet = null;
    C.petRetreat = false;
  }
  if (h.hp <= 0) { C.over = 'lose'; return; }
  C.log.push(ld(`Здоровье: вы ${h.hp}/${maxHp(h)}${C.pet ? ` · питомец ${Math.max(0, C.pet.cur)}/${C.pet.hp}` : ''} · ${low(e.name)} ${Math.max(0, Math.round(e.cur))}/${e.hp}${e.enraged ? ' (разъярён)' : ''}`));
}

function rollLoot(id, e, R) {
  const d = DROPS[id] || {}, found = [];
  (d.items || []).forEach((x) => { if (rngInt(R, 1, 100) <= x.chance) found.push(x.id); });
  if (rngInt(R, 1, 100) <= POTION_DROP_PCT) found.push(potionFor(e.level));   // зелье здоровья 10% со всех монстров; ступень по уровню монстра
  let n = 0;
  if (d.coins) { let r = rngInt(R, 1, 100), acc = 0; for (const o of d.coins.mult) { acc += o.chance; if (r <= acc) { n = rewardLvl(e) * o.k; break; } } }
  return { found, n };
}

// Итог боя применяется к состоянию героя s (на телефоне это тот же объект, что и h; на сервере — объединённое состояние).
// outcome: 'win' | 'capture' | 'lose' | 'fled'. Возвращает данные для экрана результата.
function applyOutcome(s, h, C, outcome, R, now = Date.now()) {
  const e = C.e, res = { outcome, enemy: { id: C.id, name: e.name, gender: e.gender, icon: e.icon }, coinsN: 0, items: [], xpLines: [], notes: [] };
  if (s !== h) {   // сервер: переносим здоровье героя и гибель питомцев из снимка
    s.hp = h.hp;
    (h.pets || []).forEach((hp) => { const p = (s.pets || []).find((x) => x.id === hp.id); if (p && hp.dead) p.dead = true; });
  }
  C.usedIds.forEach((pid) => { s.inv[pid] = Math.max(0, (s.inv[pid] || 0) - 1); });   // выпитые в бою зелья уходят из сумки при любом исходе
  const escort = C.mode === 'escort'; if (escort) s.daily = s.daily || {};
  if (outcome === 'fled') { if (escort) s.daily.escortSt = 'failed'; return res; }
  if (outcome === 'lose') { s.losses = (s.losses || 0) + 1; s.hp = 1; s.hpAt = now; s.hpFrac = 0; if (escort) s.daily.escortSt = 'failed'; return res; }
  s.wins = (s.wins || 0) + 1;   // победа (в т.ч. поимка) — один раз за бой; бои с людьми — позже
  const kills = outcome === 'capture' ? [C.id] : (C.kills.length ? C.kills : [C.id]);
  if (outcome === 'capture') s.captures = (s.captures || 0) + 1;   // счётчики для титулов: поимки и победы по видам
  else { s.kills = s.kills || {}; kills.forEach((id) => { s.kills[id] = (s.kills[id] || 0) + 1; }); }
  let coinsN = 0, xp = 0, fxMin = 1; const items = [];
  kills.forEach((id) => {
    const en = enemyFor(id, C.lvl || h.lvl), { found, n } = rollLoot(id, en, R);
    if (outcome !== 'capture') found.forEach((i) => items.push(i));   // при поимке вещи не выпадают, монеты — как за победу
    coinsN += n;
    const diff = h.lvl - rewardLvl(en), fx = diff <= 0 ? 1 : diff === 1 ? 0.25 : 0;   // слабые монстры: на 1 ур. ниже — 25%, на 2+ — 0%
    xp += en.xp * fx; fxMin = Math.min(fxMin, fx);
  });
  if (escort) { items.push('troll_tooth'); s.daily.escortSt = 'won'; }   // молочный зуб — доказательство выполненного задания
  items.forEach((id) => gain(s, { item: id }));
  addCoins(s, coinsN); res.coinsN = coinsN; res.items = items;
  if (outcome === 'capture') {
    const p = addPet(s, C.id), tr = trapper(s); s.flags = s.flags || {}; s.flags.captured = 1;
    res.captured = { species: p.species, rank: p.rank };
    if (fxMin > 0) { tr.prog += fxMin; if (tr.prog >= trapNeed(tr.lvl)) { tr.prog = 0; tr.lvl++; res.notes.push(`🪤 Ловец монстров: уровень ${tr.lvl}!`); } }
    if (fxMin === 0) res.notes.push('Зверь слишком слаб: мастерство ловца не растёт.');
  }
  if (fxMin < 1) res.notes.push(fxMin > 0 ? 'Слабый противник: опыта и мастерства ловца — лишь четверть.' : 'Слабый противник: опыта нет.');
  res.xpLines = addXp(s, xp);
  return res;
}

// Воспроизведение целого боя по seed и списку выборов (сервер). Возвращает {C, h, R, outcome}; outcome 'fled' — бой оборван.
function replayCombat(snap, id, seed, choices, opts) {
  const h = JSON.parse(JSON.stringify(snap)), R = makeRng(seed), C = newCombat(h, id, opts);
  for (const ch of choices) { if (C.over) break; combatRound(C, h, ch || {}, R); }
  const outcome = C.over || 'fled';
  return { C, h, R, outcome };
}
