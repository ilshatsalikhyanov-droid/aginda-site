// Весь контент игры: профессии, предметы, враги, сцены. Лор — см. LORE.md
const CLASSES = {
  seeker: { name:'Искатель', icon:'🧭', desc:'Вылазки за ресурсами и монстрами.',
    stats:{hp:30, str:3, agi:3, int:3, stamina:50, luck:1}, skill:{name:'Точный удар', cost:3, kind:'dmg', mult:1.8} },
};

// Выносливость: стоимость боя и скорость восстановления (1 очко за STAM_REGEN_MS)
const STAM_COST = 10;
// Опыт до 2-го уровня: 8 боёв с детёнышем крысы (8 опыта за бой). Остальные уровни — формула в game.js (временная).
const XP_LEVEL2 = 64;
// Опыт до 3-го уровня: 11 боёв с Крысиной Маткой (12 опыта за бой) ≈ 1 час при выносливости 50 (5 боёв сразу, дальше раз в 10 минут).
const XP_LEVEL3 = 132;
// Пороги 3→7 подогнаны 2026-10-17 по прохождению бережливым ботом (2 ч в день; кольца Первооткрывателя, кухня; хлеб ОТКЛЮЧЁН — он лишь бонус сверху; 5 прогонов с разбросом) под расчёт:
// 3→4 ≈ 3 ч, 4→5 ≈ 5 ч, 5→6 ≈ 10 ч, 6→7 ≈ 20 ч (факт на последних порогах: 2,8 / 2,6–7,4 / 8,1 / 17,7 ч; разброс между прогонами большой, особенно на 4→5). Если меняется экономика — пересчитать ботом.
const XP_LEVEL4 = 450;
const XP_LEVEL5 = 1700;
const XP_LEVEL6 = 5000;
const XP_LEVEL7 = 17500;
// Дальше (с 7-го) порог растёт в 3 раза за уровень, опыт с монстров — в 1,5 раза (⇒ боёв на уровень примерно вдвое больше)
const XP_GROWTH_MOB = 1.5, XP_GROWTH_NEED = 3;
const LEVEL_CAP_SCALING = 10;   // автолевелинг рассчитан до 10 уровня героя, дальше враги остаются на характеристиках 10-го
const STAM_REGEN_MS = 60 * 1000;

// Предметы = расходники + экипировка (см. equipment.js). Враги — monsters.js
// Титулы: бонусы дают ВСЕ полученные титулы; выбранный (s.title) только показывается в профиле и чате.
// bonus: hp — к здоровью, capture — % к шансу поимки (общий потолок 90%), dmgPct — % к урону героя.
// Счётчики: s.captures — поимки клетью, s.kills — победы по видам монстров (ведёт applyOutcome в core.js).
const RAT_KINDS = ['rat_cub', 'rat_queen', 'rat_king'];
const TITLES = {
  junior:   { name:'Младший Искатель', hint:'Выслушать наставление мастера на 3-м уровне.', bonus:{ hp:5 }, has:s=>!!(s.flags&&s.flags.m3) },
  catcher:  { name:'Ловец',            hint:'Поймать клетью 30 монстров.', bonus:{ capture:2 }, has:s=>(s.captures||0)>=30 },
  ratslayer:{ name:'Крысобой',         hint:'Победить по 10 детёнышей крысы, Крысиных Маток и Крысиных королей.', bonus:{ dmgPct:5 }, has:s=>RAT_KINDS.every((k)=>((s.kills||{})[k]||0)>=10) },
};
// Сумма бонусов полученных титулов. В снимке боя (s.tb) — посчитанная заранее (там нет флагов и счётчиков).
const titleBonus = (s, k) => s.tb ? (s.tb[k] || 0) : Object.values(TITLES).reduce((a, t) => a + (t.has(s) ? (t.bonus[k] || 0) : 0), 0);
const titleBonusText = (b) => [b.hp ? `+${b.hp} к здоровью` : '', b.capture ? `+${b.capture}% к поимке` : '', b.dmgPct ? `+${b.dmgPct}% к урону` : ''].filter(Boolean).join(', ');

// Название выбранного (или первого открытого) титула героя s; нужно и игре, и серверу (профиль игрока в чате)
const titleNameOf = (s) => { const u = Object.keys(TITLES).filter((k) => TITLES[k].has(s)), id = u.includes(s.title) ? s.title : u[0]; return id ? TITLES[id].name : ''; };

const ITEMS = {
  // Зелья здоровья лечат процент от максимума: малое 20%, среднее 35%, большое 50%. aux — вспомогательный предмет: сам занимает слот пояса (в слот встаёт сильнейшее из имеющихся).
  potion:     { name:'Малое зелье здоровья', icon:'🧪', img:'pictures/equipment/small-health-potion.jpg', desc:'Глоток горького красного отвара. Ссадины затягивает, переломы — нет.', use:{healPct:20}, aux:true, price:15 },
  potion_mid: { name:'Среднее зелье здоровья', icon:'🧪', img:'pictures/equipment/medium-health-potion.jpg', desc:'Отвар погуще. Хватит, чтобы подняться после крепкого удара.', use:{healPct:35}, aux:true, price:30 },
  potion_big: { name:'Большое зелье здоровья', icon:'🧪', img:'pictures/equipment/big-health-potion.jpg', desc:'Тяжёлая склянка под сургучом. Мёртвого не поднимет, а полумёртвого — вполне.', use:{healPct:50}, aux:true, price:50 },
  // Харчевня «Последний ужин»: мука мелется из хвостов в инвентаре (grind), блюда готовятся по рецептам с полем cook, еда даёт food: {pct, min}
  flour:      { name:'Мука', icon:'🌾', img:'pictures/equipment/flour.jpg', desc:'Серая мука для приготовления пищи.', material:true },
  rat_bread:  { name:'Крысиный хлеб', icon:'🍞', img:'pictures/equipment/rat-bread.jpg', desc:'Простая и сытная еда простолюдинов из внешнего круга.', food:{ pct:30, min:60 }, price:60, stack:true },   // можно купить в харчевне (60 бронзовых) или приготовить из муки
  ...EQUIPMENT,
  ...DROP_ITEMS,
  ...RECIPES,
};

// Какие монстры встречаются на этажах (ключи из monsters.js)
// Ежедневные задания обновляются в полночь по Москве. dayNum — номер дня; s.daily.escort — день, когда взято задание сопровождения.
const dayNum = (now) => Math.floor(((now || Date.now()) + 3 * 3600000) / 86400000);
// Состояние ежедневного задания: none (не взято) | taken | fight (бой начат) | won (зуб добыт) | failed | done (сдано рыцарю)
const dailyState = (s, now) => (s.daily && s.daily.escort === dayNum(now)) ? (s.daily.escortSt || 'taken') : 'none';
const escortTaken = (s, now) => dailyState(s, now) !== 'none';
// Кто нападает на отряд: зависит от уровня героя (пока для 3+ уровня — один откормленный детёныш тролля-болотника)
const escortFoes = (s) => ['troll_cub_fat'];
const POTION_DROP_PCT = 10;   // шанс зелья здоровья со всех монстров, %. Ступень по уровню монстра: до 5 — малое, 6–8 — среднее, с 9 — большое
const potionFor = (level) => level >= 9 ? 'potion_big' : level >= 6 ? 'potion_mid' : 'potion';
// Продажа питомца в Доме ловцов: цена по рангу × базовый уровень вида (крыса 1, Матка 2, тролль 3…); погибший — вполовину (цифры черновые)
const PET_PRICE = { D: 2, C: 5, B: 12, A: 30 };
const petPrice = (p) => Math.max(1, Math.round(PET_PRICE[p.rank] * ENEMIES[p.species].level * (p.dead ? 0.5 : 1)));
// Воскрешение питомца в Доме ловцов — на выбор: бесплатно с ожиданием (ранг D — 10 минут, каждый ранг выше +5: C 15, B 20, A 25)
// или сразу за монеты: множитель ранга (D 1, C 2, B 4, A 8) × уровень героя × 4 бронзовых (было ×5, снижено 2026-10-17).
const REVIVE_RANK_MUL = { D: 1, C: 2, B: 4, A: 8 };
const reviveMin = (p) => 10 + 5 * RANKS.indexOf(p.rank);
const revivePrice = (p, lvl) => REVIVE_RANK_MUL[p.rank] * lvl * 4;
// Описание нападающих для текста: «два детёныша тролля-болотника». Зависит от набора врагов (а он — от уровня героя).
const escortFoesText = (s) => {
  const cnt = {}; escortFoes(s).forEach((id) => { cnt[id] = (cnt[id] || 0) + 1; });
  const w = ['', 'один', 'два', 'три', 'четыре', 'пять'];
  const parts = Object.entries(cnt).map(([id, n]) => { const f = ENEMIES[id].forms || [ENEMIES[id].name.toLowerCase(), ENEMIES[id].name.toLowerCase(), ENEMIES[id].name.toLowerCase()]; return `${w[n] || n} ${n % 100 > 10 && n % 100 < 20 ? f[2] : n % 10 === 1 ? f[0] : n % 10 > 1 && n % 10 < 5 ? f[1] : f[2]}`; });
  return parts.join(' и ');
};
// Фраза для экрана нападения: один враг — «бежит ... ему», несколько — «бегут ... им»
const escortIntro = (s) => { const n = escortFoes(s).length, w = escortFoesText(s).replace(/^один /, ''); return `Едва разведывательный отряд выходит за стену, вы видите, как к повозке ${n === 1 ? 'бежит' : 'бегут'} ${w}. Вы преграждаете ${n === 1 ? 'ему' : 'им'} путь.`; };
// Ожерелье убийцы троллей: ступени выдаются рыцарем за число сданных молочных зубов (всего за всё время).
// Расчёт: задание раз в день, победа над откормленным детёнышем ~75%, игра ~2 ч в день (время жизни в игре с ожиданием, не время у экрана); уровни 3→4 ≈ 3 ч, 4→5 ≈ 5 ч, 5→6 ≈ 10 ч, 6→7 ≈ 20 ч.
// Ступень N набирается за время N+2-го уровня и надевается к следующему: 1 — к 4-му, 2 — к 5-му, 3 — к 6-му, 4 — к 7-му.
const SLAYER_STAGES = [
  { need: 2,  item: 'necklace_troll_1', flag: 'slayer1' },
  { need: 4,  item: 'necklace_troll_2', flag: 'slayer2' },
  { need: 7,  item: 'necklace_troll_3', flag: 'slayer3' },
  { need: 13, item: 'necklace_troll_4', flag: 'slayer4' },
];
// Строка про рекомендованного питомца для экрана встречи
const recPetLine = (e) => e.recPet ? `Рекомендуемый питомец: ${petName(e.recPet)}.` : '';
const ESCORT_REWARD_BRONZE = 15;   // награда рыцаря за молочный зуб (шанс на вещицу — доделать позже)
const FLOORS = { cat1:['rat_cub'], cat2:['rat_queen'], cat3:['rat_king'] };

// Условия боя с монстром (проверяет сервер при старте боя; остальные монстры доступны всем)
const FIGHT_REQ = { rat_queen: s => !!s.flags.gear, troll_cub: s => !!s.flags.m3, troll_cub_fat: () => false, rat_king: s => s.lvl >= 4, troll_bog: s => s.lvl >= 4 };   // откормленный — только в задании сопровождения   // троллей у северных стен — только младшим искателям
