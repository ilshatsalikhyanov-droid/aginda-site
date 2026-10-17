// Дроп с монстров. Значения пока стандартные — будем править.
// DROP_ITEMS — предметы, которые падают (попадают в ITEMS).
const DROP_ITEMS = {
  bronze_coin: { name:'Бронзовая монета', icon:'🥉', img:'pictures/equipment/bronze-coin.jpg', desc:'Ходовая мелочь, самая мелкая монета города.', currency:true },
  silver_coin: { name:'Серебряная монета', icon:'🥈', desc:'Сто бронзовых — одна серебряная.', currency:true },
  gold_coin:   { name:'Золотая монета', icon:'🥇', desc:'Сто серебряных — одна золотая. Во внешнем круге её мало кто держал в руках.', currency:true },
  rat_pelt:    { name:'Шкура крысёнка', icon:'🟤', img:'pictures/equipment/rat-cub-pelt.jpg', desc:'Клочок облезлого меха. Годится разве что на продажу.', junk:true, sell:1 },
  troll_tooth: { name:'Молочный зуб тролля-болотника', icon:'🦷', img:'pictures/equipment/troll-milk-tooth.jpg', desc:'Молочный зуб откормленного детёныша. Рыцарь примет его как знак, что дорога отряду расчищена.', quest:true },
  rat_king_tail: { name:'Хвост крысиного короля', icon:'🐀', img:'pictures/equipment/rat-king-tail.jpg', desc:'Толстый чешуйчатый хвост Крысиного короля. Сгодится для рецептов и для помола.', material:true, sell:5, grind:'flour' },   // grind — можно перемолоть в инвентаре: 1 хвост = 1 мука
  troll_tooth_adult: { name:'Зуб тролля-болотника', icon:'🦷', img:'pictures/equipment/troll-bog-tooth.jpg', desc:'Жёлтый клык взрослого тролля-болотника, крепкий, как камень. Сгодится для простых рецептов.', material:true, sell:5 },
  rat_hide:    { name:'Крысиная шкура', icon:'🟫', img:'pictures/equipment/rat-hide.jpg', desc:'Жёсткая шкура Крысиной Матки. Сгодится для простых рецептов.', material:true, sell:3 },
};

// material:true — метка «материал» (не хлам: для создания вещей или продажи).
// junk:true — метка «хлам» (маленькими буквами в названии); sell — цена продажи в лавке, 🥉 (нет поля — не продаётся).

// DROPS — таблица по ключу монстра (из monsters.js).
//  items: каждый предмет выпадает независимо с шансом chance, %; иначе — «Ничего».
//  coins: монеты падают всегда; количество = уровень монстра × k, k выбирается по весу chance, %.
const DROPS = {
  rat_cub: {
    items: [ { id:'rat_pelt', chance:60 } ],
    coins: { id:'bronze_coin', mult:[ {k:3, chance:50}, {k:4, chance:30}, {k:5, chance:20} ] },
  },
  troll_cub: {
    items: [],
    coins: { id:'bronze_coin', mult:[ {k:3, chance:50}, {k:4, chance:30}, {k:5, chance:20} ] },
  },
  troll_cub_fat: {
    items: [],   // молочный зуб выдаётся за победу в задании (core.js, applyOutcome)
    coins: { id:'bronze_coin', mult:[ {k:3, chance:50}, {k:4, chance:30}, {k:5, chance:20} ] },
  },
  troll_bog: {
    items: [ { id:'troll_tooth_adult', chance:30 } ],
    coins: { id:'bronze_coin', mult:[ {k:4, chance:50}, {k:6, chance:30}, {k:8, chance:20} ] },
  },
  rat_king: {
    items: [ { id:'rat_king_tail', chance:30 } ],
    coins: { id:'bronze_coin', mult:[ {k:6, chance:50}, {k:8, chance:30}, {k:10, chance:20} ] },
  },
  rat_queen: {
    items: [ { id:'rat_hide', chance:60 } ],
    coins: { id:'bronze_coin', mult:[ {k:3, chance:50}, {k:4, chance:30}, {k:5, chance:20} ] },
  },
};
