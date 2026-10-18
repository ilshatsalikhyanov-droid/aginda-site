// Экипировка. Значения пока стандартные — будем править.
// slot (тип предмета): helmet (шлем) | chest (нагрудник) | pants (штаны) | gloves (перчатки) | weapon (меч) |
//   belt (пояс, со слотами под вспомогательные предметы) | offhand (щит) | boots (сапоги) | necklace (ожерелье) | ring (кольцо, 2 слота) | earring (серьга, 2 слота) | cage (клеть-ловушка) | cloak (плащ).
// capture.base — шанс поимки по уровню существа: [{from, to, chance%}]; остальные уровни пропишем позже.
// minLvl — минимальный уровень героя для ношения (до него бонусы не действуют); maxOwn — сколько штук продаётся (по умолчанию 1).
// bonus: dmg — урон; def — защита; crit — шанс крита, %; dodge — шанс уклонения, %.
// Слоты персонажа (ключ → подпись). Кольца и серьги — по два слота; предмет типа ring/earring подходит в любой из них.
const SLOTS = {
  helmet:'Шлем', chest:'Нагрудник', pants:'Штаны', belt:'Пояс', gloves:'Перчатки', weapon:'Оружие', offhand:'Левая рука', boots:'Сапоги',
  necklace:'Ожерелье', ring1:'Кольцо', ring2:'Кольцо', earring1:'Серьга', earring2:'Серьга',
  cage:'Клеть-ловушка', cloak:'Плащ',
};
const SLOT_TYPE = { ring1:'ring', ring2:'ring', earring1:'earring', earring2:'earring' };   // тип предмета для слота (по умолчанию = ключ)

const EQUIPMENT = {
  dagger: {
    name:'Короткий кинжал', icon:'🗡️', img:'pictures/equipment/acolyte-dagger.jpg', slot:'weapon',
    desc:'Короткий кинжал из гильдейского свёртка. Против крыс сойдёт, против чего покрупнее — лучше беги.',
    bonus:{ dmg:3, def:0, crit:5, dodge:0 }, price:0,
  },
  shield: {
    name:'Простой щит', icon:'🛡️', img:'pictures/equipment/acolyte-shield.jpg', slot:'offhand',
    desc:'Деревянный щит с железной оковкой. Выдают каждому аколиту, и каждый второй теряет его в первой же вылазке.',
    bonus:{ dmg:0, def:3, crit:0, dodge:0 }, price:0,
  },
  cage_simple: {
    name:'Простая клеть-ловушка', icon:'🪤', img:'pictures/equipment/simple-cage-trap.jpg', slot:'cage',
    desc:'Железная клеть, прутья едва слышно гудят от присутствия в ней магии.',
    bonus:{ dmg:0, def:0, crit:0, dodge:0 }, tier:1,   // tier — ступень клети: монстры со ступенью выше (cageTier) ей не ловятся
    capture:{ base:[ { from:0, to:5, chance:50 } ] }, price:0,
  },
  helmet_cracked: {
    name:'Треснутый шлем аколита', icon:'⛑️', img:'pictures/equipment/cracked-acolyte-helmet.jpg', slot:'helmet',
    desc:'Шлем аколита, не вернувшегося со 2-го этажа катакомб.',
    bonus:{ dmg:0, def:1, crit:0, dodge:0 }, price:0,
  },
  boots_worn: {
    name:'Поношенные сапоги аколита', icon:'🥾', img:'pictures/equipment/worn-acolyte-boots.jpg', slot:'boots',
    desc:'Сапоги того же аколита. Разношены чужими ногами.',
    bonus:{ dmg:0, def:1, crit:0, dodge:1 }, price:0,
  },
  belt_rag: {
    name:'Тряпичный пояс', icon:'🪢', img:'pictures/equipment/cloth-belt.jpg', slot:'belt',
    desc:'Пояс из скрученного тряпья, остался от погибшего аколита. Петля под одно зелье.',
    bonus:{ def:1, hp:3 }, slots:1, price:0,   // slots — число слотов под вспомогательные предметы; у других поясов будет больше
  },
  // Ступени ожерелья: рыцарь выдаёт за число сданных молочных зубов (SLAYER_STAGES в data.js). Бонусы — заглушка: +4 здоровья и +1 урона за ступень.
  necklace_troll_1: {
    name:'Ожерелье убийцы троллей (Ступень 1)', icon:'📿', img:'pictures/equipment/troll-slayer-necklace-1.jpg', slot:'necklace',
    desc:'Шнурок с молочными зубами троллей-болотников. Рыцарь внутреннего двора вручает такой тем, кто не раз прикрыл отряд за стеной.',
    bonus:{ hp:4, dmg:1 }, price:0,
  },
  necklace_troll_2: {
    name:'Ожерелье убийцы троллей (Ступень 2)', icon:'📿', img:'pictures/equipment/troll-slayer-necklace-2.jpg', slot:'necklace',
    desc:'Зубов на шнурке прибавилось. Рыцарь внутреннего двора запомнил вас в лицо.',
    bonus:{ hp:8, dmg:2 }, price:0,
  },
  necklace_troll_3: {
    name:'Ожерелье убийцы троллей (Ступень 3)', icon:'📿', slot:'necklace',
    desc:'Тяжёлая связка зубов. Солдаты отряда кивают вам, как своему.',
    bonus:{ hp:12, dmg:3 }, price:0,
  },
  necklace_troll_4: {
    name:'Ожерелье убийцы троллей (Ступень 4)', icon:'📿', slot:'necklace',
    desc:'Зубов столько, что шнурок пришлось сменить на кожаный ремешок. За стеной о вас уже говорят.',
    bonus:{ hp:16, dmg:4 }, price:0,
  },
  belt_rat_king: {
    name:'Пояс из хвостов крысиного короля', icon:'🪢', img:'pictures/equipment/rat-king-tail-belt.jpg', slot:'belt',
    desc:'Сплетён из хвостов Крысиного короля: жёсткий, как сыромятный ремень, и пахнет катакомбами. Петля под одно зелье.',
    bonus:{ def:2, hp:6 }, slots:1, price:0,   // характеристики временные
  },
  ring_pioneer: {
    name:'Кольцо Первооткрывателя', icon:'💍', img:'pictures/equipment/pioneer-ring.jpg', slot:'ring', minLvl:3, maxOwn:2,   // minLvl — с какого уровня можно носить; maxOwn — сколько штук можно купить (колец два слота)
    desc:'Грубое медное кольцо без камня. Такие покупают перед первым выходом за стену — на счастье. Помогает ли, никто не проверял, но носят все.',
    bonus:{ dmg:1, hp:2 }, price:50,   // подбор симуляцией: два кольца поднимают долю побед над детёнышем тролля на 3 уровне примерно с 87% до 92–93%
  },
  chest_simple: {
    name:'Простой нагрудник', icon:'🦺', img:'pictures/equipment/simple-chest.jpg', slot:'chest',
    desc:'Толстая кожа на ремнях. От когтей спасёт, от клыков — не всегда.',
    bonus:{ def:2, hp:5 }, price:0,
  },
  gloves_simple: {
    name:'Простые перчатки', icon:'🧤', img:'pictures/equipment/simple-gloves.jpg', slot:'gloves',
    desc:'Грубые кожаные перчатки. Рукоять в них не скользит, даже если ладони в крови.',
    bonus:{ dmg:1, def:1 }, price:0,
  },
  pants_simple: {
    name:'Простые штаны', icon:'👖', img:'pictures/equipment/simple-pants.jpg', slot:'pants',
    desc:'Плотная ткань с кожаными вставками на коленях. Стандартный выпуск гильдии.',
    bonus:{ def:1, dodge:1 }, price:0,
  },
  cloak_rat_poor: {
    name:'Некачественный крысиный плащ', icon:'🧥', img:'pictures/equipment/rat-cloak-poor.jpg', slot:'cloak',
    desc:'Сшит из крысиных шкур на скорую руку.',
    bonus:{ hp:5, luck:1 }, price:0,
  },
};

// ===== Комплекты путей героя (этап 2, решено автором 2026-10-18) =====
// По 7 вещей на путь: оружие, щит (левая рука), нагрудник, шлем, перчатки, штаны, сапоги. Оружие, щит и нагрудник покупаются («Богатый Искатель»),
// остальное — рецепты у ремесленницы. Вещь пути носит только свой путь (поле path), с minLvl 5. Бонусы за 2, 4 и 7 вещей одного комплекта — SETS.
// bonus.pet — % к силе питомца (только у Укротителя). Бонусы комплектов: те же ключи плюс taken (% к получаемому урону), dmgPct, hpPct (% к урону, здоровью).
// Цифры черновые: SET_POWER множит все бонусы комплектов (подгонка dev/pathcheck.js: с комплектом ≈80% побед, без — ≈10% на 5-м уровне).
const SET_POWER = { shield:1.5, sword:2.5, tamer:2.17 };   // по путям: подогнано dev/tune-sets.js (2026-10-18): на 5-м уровне с комплектом ≈80% побед, без ≈10%
const sp = (v, path) => (v ? (Math.round(v * SET_POWER[path]) || (v > 0 ? 1 : -1)) : 0);
const spAll = (b, path) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, k === 'share' ? v : sp(v, path)]));   // share (доля удара на герое, в процентных пунктах) не масштабируется
const SWORD_SHARE = { 2:4, 4:4, 7:4 };   // «Парирование» Меча: доля удара на герое растёт на столько процентных пунктов за 2, 4 и 7 вещей (всего 62% вместо 50%; у Щита 84%)
const SETS = {
  panzer:   { name:'Панцирный комплект', path:'shield', bonus:{ 2:spAll({ hp:20, share:10 }, 'shield'), 4:spAll({ taken:-5, share:12 }, 'shield'), 7:spAll({ hpPct:10, taken:-5, share:12 }, 'shield') } },
  zubchaty: { name:'Зубчатый комплект',  path:'sword',  bonus:{ 2:spAll({ crit:4, share:SWORD_SHARE[2] }, 'sword'), 4:spAll({ dmgPct:5, share:SWORD_SHARE[4] }, 'sword'), 7:spAll({ dmgPct:8, crit:6, share:SWORD_SHARE[7] }, 'sword') } },
  lovchiy:  { name:'Ловчий комплект',    path:'tamer',  bonus:{ 2:spAll({ pet:5 }, 'tamer'), 4:spAll({ pet:5, hp:15 }, 'tamer'), 7:spAll({ pet:8, hpPct:10 }, 'tamer') } },
};
const SET_ITEMS = [];   // [id, цена покупки | 0 (крафт), слот, путь]: нужен для лавок и рецептов
(() => {
  const defs = {
    shield: ['panzer', {
      weapon:  ['Панцирная булава',    '🔨', 'Тяжёлая булава в панцирной оковке. Не режет, а ломает.',                       { dmg:3 }],
      offhand: ['Панцирный щит',       '🛡️', 'Щит, обшитый твёрдой шкурой: об него ломают зубы.',                             { def:3, hp:15 }],
      chest:   ['Панцирный нагрудник', '🦺', 'Кованые пластины под толстой шкурой. Тяжёлый, зато держит.',                    { def:2, hp:35 }],
      helmet:  ['Панцирный шлем',      '⛑️', 'Шлем с назатыльником из шкуры. Голова целее, шея тоже.',                            { def:1, hp:12 }],
      gloves:  ['Панцирные перчатки',  '🧤', 'Кожа и пластины до локтя. Удар отводят, как щит.',                              { def:1, dmg:1, hp:6 }],
      pants:   ['Панцирные штаны',     '👖', 'Жёсткие, скрипят при ходьбе. От клыков спасают.',                               { hp:15, dodge:1 }],
      boots:   ['Панцирные сапоги',    '🥾', 'Тяжёлые, зато стоять в них крепко.',                                              { hp:10, dodge:1 }],
    }],
    sword: ['zubchaty', {
      weapon:  ['Зубчатый меч',        '⚔️', 'Лезвие с зазубринами: рана получается рваная и злая.',                           { dmg:8, crit:3 }],
      offhand: ['Зубчатый баклер',     '🛡️', 'Маленький круглый щит с шипами. Больше для удара, чем для защиты.',             { dmg:3, dodge:2 }],
      chest:   ['Зубчатый нагрудник',  '🦺', 'Лёгкая кираса с шипами на плечах. Не держит удар, зато не мешает бить.',          { hp:12, def:1 }],
      helmet:  ['Зубчатый шлем',       '⛑️', 'Шлем с гребнем из зубов. Выглядит так, что враг колеблется.',                    { crit:2, hp:4 }],
      gloves:  ['Зубчатые перчатки',   '🧤', 'Кожаные, с шипами на костяшках.',                                               { dmg:3, crit:2 }],
      pants:   ['Зубчатые штаны',      '👖', 'Лёгкие, не стесняют шаг.',                                                      { dodge:2, hp:6 }],
      boots:   ['Зубчатые сапоги',     '🥾', 'Лёгкие сапоги с подковками: быстро войти и быстро выйти.',                       { dodge:2, dmg:1 }],
    }],
    tamer: ['lovchiy', {
      weapon:  ['Ловчий багор',        '🔱', 'Длинный крюк, чтобы придержать зверя на расстоянии.',   { dmg:3, pet:4 }],
      offhand: ['Манок',               '🎺', 'Костяная дудка. Зверь слышит её лучше, чем хозяина.',                            { pet:6, def:1, hp:8 }],
      chest:   ['Ловчий жилет',        '🦺', 'Плотный жилет с лямками для клетей и поводков.',                                { hp:18, pet:2 }],
      helmet:  ['Ловчий капюшон',      '⛑️', 'Закрывает уши от рёва, лицо — от клыков.',                                      { pet:2, hp:8 }],
      gloves:  ['Ловчьи рукавицы',     '🧤', 'Толстые рукавицы: зверя держать и не остаться без пальцев.',                    { dmg:1, pet:2, hp:4 }],
      pants:   ['Ловчьи штаны',        '👖', 'С карманами под приманку.',                                                      { hp:8, dodge:1, pet:2 }],
      boots:   ['Ловчьи сапоги',       '🥾', 'Тихие, чтобы подойти к зверю незамеченным.',                                    { dodge:2, hp:6, pet:2 }],
    }],
  };
  const price = { weapon: 90, offhand: 70, chest: 90 };   // покупаются в «Богатом Искателе»; остальные вещи крафтятся (рецепты у ремесленницы)
  // картинки значков (pictures/equipment/<имя>.jpg); у кого нет — остаётся эмодзи
  const img = { shield_weapon:'panzer-mace', shield_offhand:'panzer-shield', shield_chest:'panzer-chest', shield_helmet:'panzer-helmet',
                shield_gloves:'panzer-gloves', shield_pants:'panzer-pants', shield_boots:'panzer-boots',
                sword_weapon:'zubchaty-sword', sword_offhand:'zubchaty-buckler', sword_chest:'zubchaty-chest', sword_helmet:'zubchaty-helmet',
                sword_gloves:'zubchaty-gloves', sword_pants:'zubchaty-pants', sword_boots:'zubchaty-boots',
                tamer_weapon:'lovchiy-hook', tamer_offhand:'lovchiy-lure', tamer_chest:'lovchiy-vest', tamer_helmet:'lovchiy-hood',
                tamer_gloves:'lovchiy-gloves', tamer_pants:'lovchiy-pants' };
  Object.keys(defs).forEach((path) => {
    const [set, items] = defs[path];
    Object.keys(items).forEach((slot) => {
      const [name, icon, desc, stats] = items[slot], id = path + '_' + slot;
      EQUIPMENT[id] = { name, icon, slot, path, set, minLvl: 5, desc, bonus: spAll(stats, path), price: price[slot] || 0 };
      if (img[id]) EQUIPMENT[id].img = 'pictures/equipment/' + img[id] + '.jpg';
      SET_ITEMS.push([id, price[slot] || 0, slot, path]);
    });
  });
})();
// Прочная клеть Укротителя: ступень 2 (ловит и тролля-болотника), ловит боссов; шанс поимки по уровню существа 0–5 (ступени 6–8 и 9–10 — позже).
EQUIPMENT.cage_sturdy = {
  name:'Прочная клеть-ловушка', icon:'🪤', slot:'cage', path:'tamer', minLvl:5, tier:2, bossOk:true,
  desc:'Клеть с двойными прутьями. Гудит так, что зубы ноют. Держит даже то, что обычную клеть разгибает.',
  bonus:{}, capture:{ base:[ { from:0, to:5, chance:50 } ] }, price:120,
};
