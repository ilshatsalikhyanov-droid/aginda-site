// Экипировка. Значения пока стандартные — будем править.
// slot (тип предмета): helmet (шлем) | chest (нагрудник) | pants (штаны) | gloves (перчатки) | weapon (меч) |
//   belt (пояс, со слотами под вспомогательные предметы) | offhand (щит) | boots (сапоги) | necklace (ожерелье) | ring (кольцо, 2 слота) | earring (серьга, 2 слота) | cage (клеть-ловушка) | cloak (плащ).
// capture.base — шанс поимки по уровню существа: [{from, to, chance%}]; остальные уровни пропишем позже.
// minLvl — минимальный уровень героя для ношения (до него бонусы не действуют); maxOwn — сколько штук продаётся (по умолчанию 1).
// bonus: dmg — урон; def — защита; crit — шанс крита, %; dodge — шанс уклонения, %.
// Слоты персонажа (ключ → подпись). Кольца и серьги — по два слота; предмет типа ring/earring подходит в любой из них.
const SLOTS = {
  helmet:'Шлем', chest:'Нагрудник', pants:'Штаны', belt:'Пояс', gloves:'Перчатки', weapon:'Оружие', offhand:'Щит', boots:'Сапоги',
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
    name:'Ожерелье убийцы троллей (Ступень 2)', icon:'📿', slot:'necklace',
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
