// ДЕЙСТВИЯ ИГРОКА С ЭКОНОМИКОЙ (этап Б2): надеть/снять, зелье, продажа, питомцы, синергия, крафт, награды сцен.
// Чистый код: те же функции работают на телефоне (мгновенно, для экрана) и на сервере (настоящий результат).
// Игрок копит действия в очереди и отправляет пачкой; сервер повторяет их над своим состоянием и отвергает невозможные.
// applyOp(s, op) → {ok, msg?, res?}. При ok:false состояние не меняется.
const OP_ERR = (msg) => ({ ok: false, msg });
const keyFor = (s, id) => { const ks = slotsFor(ITEMS[id].slot); return ks.find((k) => !s.equip[k]) || ks[0]; };   // слот для надевания: свободный или первый
const clampHp = (s) => { s.hp = Math.min(s.hp, maxHp(s)); };
const craftable = (s, r) => Object.entries(r.ingredients).every(([k, n]) => (s.inv[k] || 0) >= n);
const sellQty = (s, id) => { const it = ITEMS[id]; if (!it || !it.sell || it.currency) return 0; return Math.max(0, (s.inv[id] || 0) - equippedCount(s, id)); };
const itemPrice = (it, s) => (it.priceLvl ? it.priceLvl * s.lvl : it.price);   // priceLvl — цена = уровень героя × priceLvl
const junkSum = (s) => Object.keys(s.inv).filter((id) => ITEMS[id] && ITEMS[id].junk).reduce((a, id) => a + sellQty(s, id) * ITEMS[id].sell, 0);

function applyOp(s, op, ctx = {}) {   // ctx: {admin} — админские действия (admin_*) выполняются только для админа
  if (op.op.startsWith('admin_') && !ctx.admin) return OP_ERR('Нет прав.');
  switch (op.op) {
    case 'equip': {   // {key, id|null}
      if (!SLOTS[op.key]) return OP_ERR('Нет такого слота.');
      if (op.id == null) { s.equip[op.key] = null; clampHp(s); return { ok: true }; }
      const it = ITEMS[op.id];
      if (!it || it.slot !== slotType(op.key)) return OP_ERR('Это сюда не надеть.');
      if (it.path && it.path !== s.path) return OP_ERR('Это снаряжение другого пути.');
      if (it.minLvl && s.lvl < it.minLvl) return OP_ERR(`${it.name}: нужен ${it.minLvl}-й уровень.`);
      if ((s.inv[op.id] || 0) - equippedCount(s, op.id) + (s.equip[op.key] === op.id ? 1 : 0) < 1) return OP_ERR('Нет такого предмета.');
      s.equip[op.key] = op.id; clampHp(s); return { ok: true };
    }
    case 'use': {     // {id}
      const it = ITEMS[op.id];
      if (!it || !it.use || (s.inv[op.id] || 0) < 1) return OP_ERR('Нечего использовать.');
      s.inv[op.id]--; s.hp = Math.min(maxHp(s), s.hp + healAmount(s, op.id)); return { ok: true };
    }
    case 'sell': {    // {id, n}
      const q = Math.min(Math.floor(Number(op.n) || 0), sellQty(s, op.id));
      if (q < 1) return OP_ERR('Это не продать.');
      const sum = ITEMS[op.id].sell * q; s.inv[op.id] -= q; addCoins(s, sum);
      return { ok: true, res: { name: ITEMS[op.id].name, q, sum } };
    }
    case 'sellJunk': {
      const sold = [], sum = junkSum(s);
      Object.keys(s.inv).filter((id) => ITEMS[id] && ITEMS[id].junk).forEach((id) => { const q = sellQty(s, id); if (q) { s.inv[id] -= q; sold.push(`${ITEMS[id].name} ×${q}`); } });
      if (!sum) return OP_ERR('Хлама нет.');
      addCoins(s, sum); return { ok: true, res: { sold, sum } };
    }
    case 'buy': {     // {id}
      const it = ITEMS[op.id], price = it && itemPrice(it, s);
      if (it && it.path && it.path !== s.path) return OP_ERR('Это снаряжение другого пути.');
      if (!it || !price || it.currency || coins(s) < price) return OP_ERR('Не хватает монет.');
      if (!it.use && !it.stack && (s.inv[op.id] || 0) >= (it.maxOwn || 1)) return OP_ERR('Уже куплено.');
      spend(s, price); s.inv[op.id] = (s.inv[op.id] || 0) + 1; autoEquip(s, op.id); return { ok: true };
    }
    case 'setpet': {  // {id|null}
      if (op.id == null) { s.pet = null; return { ok: true }; }
      const p = (s.pets || []).find((x) => x.id === op.id);
      if (!p || p.dead) return OP_ERR('Нет такого питомца.');
      s.pet = p.id; return { ok: true };
    }
    case 'grind': {   // {id, n}: перемолоть n штук (хвосты → мука, 1 к 1)
      const it = ITEMS[op.id], q = Math.min(Math.floor(Number(op.n) || 0), (s.inv[op.id] || 0));
      if (!it || !it.grind) return OP_ERR('Это не перемолоть.');
      if (q < 1) return OP_ERR('Нечего молоть.');
      s.inv[op.id] -= q; s.inv[it.grind] = (s.inv[it.grind] || 0) + q;
      return { ok: true, res: { q, into: it.grind } };
    }
    case 'cook': {    // {id, seed}: приготовить блюдо по рецепту из сумки. Рецепт и продукты уходят при любом исходе; шанс бросает сервер (seed)
      const it = ITEMS[op.id], r = it && it.cook;
      if (!r || (s.inv[op.id] || 0) < 1) return OP_ERR('Нет такого рецепта.');
      if (!craftable(s, r)) return OP_ERR('Не хватает продуктов.');
      Object.entries(r.ingredients).forEach(([k, n]) => s.inv[k] -= n);
      s.inv[op.id]--;
      const win = rngInt(makeRng(op.seed >>> 0), 1, 100) <= r.chance;
      if (win) s.inv[r.result] = (s.inv[r.result] || 0) + 1;
      return { ok: true, res: { win, result: r.result } };
    }
    case 'eat': {     // {id}: съесть блюдо — бонус на food.min минут с этого момента (новое блюдо начинает отсчёт заново, не складывается)
      const it = ITEMS[op.id], now = ctx.now || Date.now();
      if (!it || !it.food || (s.inv[op.id] || 0) < 1) return OP_ERR('Нечего есть.');
      s.inv[op.id]--; s.buff = { id: op.id, pct: it.food.pct, until: now + it.food.min * 60000 };
      return { ok: true, res: { pct: it.food.pct, min: it.food.min } };
    }
    case 'sell_pet': { // {id}: продать питомца в Доме ловцов (не сидящего в клети и не на воскрешении)
      const p = (s.pets || []).find((x) => x.id === op.id);
      if (!p) return OP_ERR('Нет такого питомца.');
      if (s.pet === p.id) return OP_ERR('Сначала выпустите питомца из клети.');
      if (p.reviveAt) return OP_ERR('Питомец сейчас у инструктора.');
      const sum = petPrice(p); s.pets = s.pets.filter((x) => x !== p); addCoins(s, sum);
      return { ok: true, res: { species: p.species, rank: p.rank, dead: !!p.dead, sum } };
    }
    case 'synergy': { // {species, rank}: два живых питомца вида и ранга → один рангом выше
      const next = RANKS[RANKS.indexOf(op.rank) + 1];
      const list = (s.pets || []).filter((p) => !p.dead && p.species === op.species && p.rank === op.rank);
      if (!next || list.length < 2) return OP_ERR('Нужны два питомца одного вида и ранга.');
      const two = [...list].sort((a, b) => (s.pet === a.id) - (s.pet === b.id)).slice(0, 2), hadPet = two.some((p) => p.id === s.pet);
      s.pets = s.pets.filter((p) => !two.includes(p));
      if (hadPet) s.pet = null;
      const np = addPet(s, op.species, next); if (hadPet) s.pet = np.id;
      return { ok: true, res: { species: np.species, rank: np.rank, from: op.rank } };
    }
    case 'craft': {   // {id, seed}: рецепт из сумки. Шанс бросает сервер (seed выдаёт он)
      const it = ITEMS[op.id], r = it && it.recipe;
      if (!r || (s.inv[op.id] || 0) < 1) return OP_ERR('Нет такого рецепта.');
      if (it.path && it.path !== s.path) return OP_ERR('Этот рецепт для другого пути.');
      if (!craftable(s, r)) return OP_ERR('Не хватает материалов.');
      Object.entries(r.ingredients).forEach(([k, n]) => s.inv[k] -= n);
      s.inv[op.id]--;
      const win = rngInt(makeRng(op.seed >>> 0), 1, 100) <= r.chance;
      if (win) { gain(s, { item: r.result }); s.flags = s.flags || {}; if (r.result === 'cloak_rat_poor') s.flags.cloak_made = 1; }
      return { ok: true, res: { win, result: r.result } };
    }
    case 'scene': {   // {id}: награда за вход в сцену (подарки, рецепты). Однократность — по флагам внутри onEnter
      const sc = SCENES[op.id];
      if (!sc || !sc.grant || !sc.onEnter) return OP_ERR('Нечего получать.');
      s.flags = s.flags || {};
      if (sc.needs && !sc.needs(s, ctx)) return OP_ERR('Сюда пока рано.');   // порядок заданий: награда только после нужных шагов
      return { ok: true, res: { log: sc.onEnter(s, ctx) || [] } };
    }
    case 'revive': {  // {id, pay}: воскресить погибшего питомца — либо за монеты сразу (pay), либо бесплатно с ожиданием
      const p = (s.pets || []).find((x) => x.id === op.id), now = ctx.now || Date.now();
      if (!p || !p.dead) return OP_ERR('Этого питомца воскрешать не нужно.');
      if (op.pay) {   // за монеты — сразу; можно и того, кто уже ждёт у инструктора
        const price = revivePrice(p, s.lvl);
        if (coins(s) < price) return OP_ERR('Не хватает монет.');
        spend(s, price); p.dead = false; delete p.reviveAt;
        return { ok: true, res: { species: p.species, rank: p.rank, price, now: true } };
      }
      if (p.reviveAt) return OP_ERR('Этого питомца воскрешать не нужно.');
      if (s.pets.some((x) => x.dead && x.reviveAt)) return OP_ERR('Инструктор воскрешает только одного питомца за раз.');
      p.reviveAt = now + reviveMin(p) * 60000;
      return { ok: true, res: { species: p.species, rank: p.rank, min: reviveMin(p) } };
    }
    case 'revive_take': { // {id}: забрать питомца, когда время вышло
      const p = (s.pets || []).find((x) => x.id === op.id), now = ctx.now || Date.now();
      if (!p || !p.dead || !p.reviveAt) return OP_ERR('Питомец не на воскрешении.');
      if (now < p.reviveAt) return OP_ERR('Ещё не готов.');
      p.dead = false; delete p.reviveAt; return { ok: true, res: { species: p.species, rank: p.rank } };
    }
    case 'settitle': { // {id|null}: выбрать открытый титул
      if (op.id != null && !(TITLES[op.id] && TITLES[op.id].has(s))) return OP_ERR('Титул не открыт.');
      s.title = op.id == null ? null : op.id; return { ok: true };
    }
    // ---- админские действия: работают через сервер, как у обычного игрока (сервер проверяет ADMIN_IDS)
    case 'admin_level': { // {d: ±1}
      const nl = Math.max(1, s.lvl + (op.d > 0 ? 1 : -1)); if (nl === s.lvl) return { ok: true };
      s.lvl = nl; s.xp = 0; s.hp = op.d > 0 ? maxHp(s) : Math.min(s.hp, maxHp(s)); return { ok: true };
    }
    case 'admin_restore': { // здоровье, выносливость и питомец
      s.hp = maxHp(s); s.hpFrac = 0; s.hpAt = ctx.now || Date.now(); s.stam = maxStam(s); s.stamAt = s.hpAt;
      const pp = curPet(s); if (pp) pp.dead = false;
      return { ok: true };
    }
    case 'admin_item': {  // {id, d}
      if (!ITEMS[op.id]) return OP_ERR('Нет такого предмета.');
      s.inv[op.id] = Math.max(0, (s.inv[op.id] || 0) + (op.d > 0 ? 1 : -1));
      if (ITEMS[op.id].currency) setCoins(s, coins(s));
      Object.keys(s.equip).forEach((k) => { if (s.equip[k] === op.id && equippedCount(s, op.id) > s.inv[op.id]) s.equip[k] = null; });
      clampHp(s); return { ok: true };
    }
    case 'admin_task': {  // {task}: сбросить задание, чтобы перепройти его (флаги, при необходимости уровень, выданные вещи)
      const f = s.flags = s.flags || {}, drop = (id) => { delete s.inv[id]; Object.keys(s.equip).forEach((k) => { if (s.equip[k] === id) s.equip[k] = null; }); };
      switch (op.task) {
        case 'contract': delete f.contract; break;
        case 'cage': delete f.cage_gift; drop('cage_simple'); break;
        case 'lvl2': s.lvl = 1; s.xp = 0; s.hp = Math.min(s.hp, maxHp(s)); break;
        case 'gear': delete f.gear; drop('helmet_cracked'); drop('boots_worn'); break;
        case 'cloak': delete f.cloak_made; delete f.recipe; drop('cloak_rat_poor'); drop('recipe_cloak_poor'); break;
        case 'lvl3': s.lvl = Math.min(s.lvl, 2); s.xp = 0; s.hp = Math.min(s.hp, maxHp(s)); break;
        case 'm3': delete f.m3; delete f.m3gear; drop('chest_simple'); drop('gloves_simple'); drop('pants_simple'); if (s.title === 'junior') s.title = null; break;
        case 'knight': delete f.knight_met; delete f.knight_task; break;
        case 'lvl4': s.lvl = Math.min(s.lvl, 3); s.xp = 0; delete s.path; clampHp(s); break;
        case 'path_ment': delete f.heard_shield; delete f.heard_sword; delete f.heard_tamer; break;
        case 'path_q': delete f.path_quest; delete f.path_free; delete f.heard_shield; delete f.heard_sword; delete f.heard_tamer; delete s.path; clampHp(s); break;
        case 'path_pick': delete f.path_free; delete s.path; clampHp(s); break;
        case 'escort': delete s.daily; drop('troll_tooth'); break;
        default: return OP_ERR('Неизвестное задание.');
      }
      clampHp(s); return { ok: true };
    }
    case 'admin_pet': {   // {species, rank}
      if (!ENEMIES[op.species] || !RANKS.includes(op.rank)) return OP_ERR('Нет такого питомца.');
      addPet(s, op.species, op.rank); return { ok: true };
    }
  }
  return OP_ERR('Неизвестное действие.');
}
