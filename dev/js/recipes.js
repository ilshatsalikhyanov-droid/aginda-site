// Рецепты (предметы-рецепты). Статус: создание вещей будет в «Лавке ремесленника» (Кривой переулок) — пока ожидание.
// recipe.tier — категория сложности (простой → редкий и выше); chance — шанс создания, %;
// ingredients — { id предмета: количество }; result — id создаваемого предмета.
// Правила: у простых рецептов шанс 100%, рецепт исчезает после создания. У редких и выше при создании
// (удачном или нет) пропадают и рецепт, и ингредиенты. Простые рецепты продаются в лавке ремесленника,
// редкие и выше падают с монстров, с событий, выдаются за задания (источники — позже).
// Рецепты блюд (поле cook, не recipe): покупаются в харчевне «Последний ужин» за фиксированную цену (price, от уровня не зависит). Одноразовые: при готовке
// рецепт исчезает всегда; удача (chance%) — блюдо, неудача — пропадают и продукты. stack — покупать можно сколько угодно.
const RECIPES = {
  recipe_rat_bread: {
    name:'Рецепт: Крысиный хлеб', icon:'📜', img:'pictures/equipment/simple-recipe.jpg',
    desc:'Рецепт блюда: в одном случае из десяти всё подгорает. Одноразовый.',
    cook:{ tier:'блюдо', chance:90, ingredients:{ flour:2 }, result:'rat_bread' }, price:30, stack:true,
  },
  recipe_rat_king_belt: {
    name:'Рецепт: Пояс из хвостов крысиного короля', icon:'📜', img:'pictures/equipment/simple-recipe.jpg',
    desc:'Простой рецепт. Срабатывает всегда, одноразовый.',
    recipe:{ tier:'простой', chance:100, ingredients:{ rat_king_tail:3, troll_tooth_adult:2 }, result:'belt_rat_king' }, price:100,
  },
  recipe_cloak_poor: {
    name:'Рецепт: Некачественный крысиный плащ', icon:'📜', img:'pictures/equipment/simple-recipe.jpg',
    desc:'Простой рецепт. Срабатывает всегда, одноразовый.',
    recipe:{ tier:'простой', chance:100, ingredients:{ rat_hide:3 }, result:'cloak_rat_poor' },
  },
};

// Рецепты вещей путей (этап 2): шлем, перчатки, штаны и сапоги каждого пути. Простые (шанс 100%, одноразовые), у ремесленницы по 25 бронзовых; видны только своему пути.
(() => {
  const mats = {
    helmet: { rat_king_tail:1, rat_hide:1 },
    gloves: { rat_king_tail:1, rat_hide:1 },
    pants:  { rat_hide:2, rat_king_tail:1 },
    boots:  { rat_king_tail:2 },
  };
  SET_ITEMS.filter(([, price]) => !price).forEach(([id, , slot, path]) => {
    RECIPES['recipe_' + id] = {
      name:'Рецепт: ' + EQUIPMENT[id].name, icon:'📜', img:'pictures/equipment/simple-recipe.jpg', path,
      desc:'Простой рецепт. Срабатывает всегда, одноразовый.',
      recipe:{ tier:'простой', chance:100, ingredients:{ ...mats[slot] }, result:id }, price:25,
    };
  });
})();
