// Сцены игры (текст, выборы, картинки). Вычисления и данные — в data.js и core.js.
// Сцена: text (строка или функция), choices[], onEnter(state), combat:{enemy,win,lose}
const SCENES = {
  guild_hall: {
    place:'Гильдия искателей',
    title:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    text:s=>`Огромный зал гудит от голосов и звона монет. Одни искатели только что взяли задания, другие, изрядно потрёпанные, вернулись из внешнего мира за наградой.

${s.flags.m3?'В дальнем углу, особняком от толпы, стоит рыцарь в белом плаще.':'У входа скучает караульный. На ваш вопрос, где подписать контракт искателя, он молча кивает в глубь зала.'}`,
    choices:[
      {t:'Подойти к Рыцарю внутреннего двора', to:'knight_a', if:s=>!!s.flags.m3},
      {t:'Подойти к мастеру-наставнику', to:'guild_master'},
      {t:'Выйти на площадь', to:'city_center'},
    ]},

  guild_master: {
    place:'Гильдия искателей',
    title:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},   // приближаемся к мастеру-наставнику
    text:`За столом стоит мастер-наставник: ему далеко за пятьдесят, а правой руки нет. Он смеряет вас взглядом и сразу понимает, зачем вы пришли.

Таких аколитов здесь десятки в неделю, и едва ли один становится искателем. Остальные выбирают жизнь ремесленника или гибнут в первых вылазках.`,
    choices:[
      {t:'Заговорить с мастером-наставником', to:'master_talk', if:s=>!s.flags.contract},
      {t:'Поговорить с мастером-наставником', to:'master_after', if:s=>s.flags.contract},
      {t:'Назад', to:'guild_hall'},
      {t:'Выйти на площадь', to:'city_center'},
    ]},

  master_talk: {
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},   // приближаемся к мастеру-наставнику (та же картинка, что и в разговоре)
    text:`Мастер-наставник выслушивает вас, не перебивая, затем левой рукой выдвигает ящик стола и кладёт перед вами потёртый лист. В верхней строке выведено: «Стандартный контракт искателя».

— Читать необязательно, — бросает он. — Всё равно подпишешь. Но запомни: подпись ставится один раз.

Рядом лежит перо.`,
    choices:[
      {t:'Подписать контракт', to:'contract_signed'},
      {t:'Назад', to:'guild_master'},
    ]},

  contract_signed: {
    grant:true,   // вход в сцену выдаёт награду: серверу отправляется действие scene
    resume:'guild_master',   // при повторном входе (перезапуск игры) — не показывать подписание снова
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},   // приближаемся к мастеру-наставнику (та же картинка, что и в разговоре)
    text:`Мастер-наставник убирает лист в стол.

— Поздравляю. Теперь ты искатель, хотя поздравлять тут не с чем. С сегодняшнего дня можешь брать базовые контракты. Но ты пока 1-го уровня, и выход за стену гарантирует смерть от первого попавшегося детёныша тролля-болотника.

— Ступай в катакомбы и бей крыс, как минимум до 2-го уровня. Потом возвращайся.`,
    onEnter:s=>{
      if(s.flags.contract) return;
      s.flags.contract=1;
      return ['Получено: '+['dagger','shield'].map(id=>{gain(s,{item:id});return iconHtml(ITEMS[id])+' '+ITEMS[id].name;}).join(', ')];
    },
    choices:[{t:'Далее', to:'contract_gift'}]},
  contract_gift: {
    resume:'guild_master',
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},   // приближаемся к мастеру-наставнику (та же картинка, что и в разговоре)
    text:`Левой рукой он подталкивает к вам свёрток.

— Стандартная экипировка аколита: простой щит и короткий кинжал. Не потеряй.`,
    choices:[{t:'Далее', to:'contract_tip'}]},
  contract_tip: {
    resume:'guild_master',
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},   // приближаемся к мастеру-наставнику (та же картинка, что и в разговоре)
    text:`Вы уже у двери, когда мастер-наставник окликает вас:

— Да, и загляни к ловцам в Кривом переулке. Без этих ребят твоя судьба за стеной будет печальной и недолгой.`,
    choices:[{t:'Выйти на площадь', to:'city_center'}]},

  master_after: {
    needs:s=>s.lvl>=3&&!!s.flags.gear&&!s.flags.m3gear,   // нагрудник, перчатки и штаны: только на 3-м уровне после снаряжения аколита
    grant:true,
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},
    onEnter:s=>{
      if(s.lvl<3||!s.flags.gear||s.flags.m3gear)return;
      s.flags.m3gear=1;['chest_simple','gloves_simple','pants_simple'].forEach(id=>gain(s,{item:id}));
      return ['Получено: '+['chest_simple','gloves_simple','pants_simple'].map(id=>iconHtml(ITEMS[id])+' '+ITEMS[id].name).join(', ')+' (надеты)'];
    },
    text:s=>s.lvl<2
      ?`— Рано пришёл. Добей крыс до второго уровня, тогда поговорим.`
      :!s.flags.gear
      ?`— А, это ты, аколит. Я про тебя уже и забыл.

Ну что, думал, почикал несколько детёнышей и можешь ходить за стену? Возьми из дальнего угла шлем и сапоги аколита, что умер давеча на 2-м этаже катакомб, да иди и закончи его задание. Если всё-таки получишь 3-й уровень — возвращайся, подумаем, что с тобой делать.`
      :s.lvl<3
      ?`— Сначала третий уровень. Потом приходи.`
      :!s.flags.m3
      ?`— А ты упорный аколит, возможно, ты не так уж и безнадёжен. Застенье покажет.

Держи нагрудник, перчатки и штаны.`
      :`— Пока нам говорить не о чем. Испарись.`,
    choices:[
      {t:'Далее', to:'master3_b', if:s=>s.lvl>=3&&!!s.flags.m3gear&&!s.flags.m3},
      {t:'Забрать шлем и сапоги', to:'master_gear', if:s=>s.lvl>=2&&!s.flags.gear},
      {t:'Назад', to:'guild_master'},
    ]},
  master3_b: {
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},
    resume:'master_after',
    text:`— Теперь ты готов к своему первому выходу за стену. Советую далеко не ходить: прямо за стеной снуют детёныши троллей-болотников, они должны быть тебе по зубам.`,
    choices:[{t:'Далее', to:'master3_c'}]},
  master3_c: {
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},
    resume:'master_after',
    text:`— Как ты знаешь, каждый день из внутреннего двора выезжают солдаты с повозкой в поход. Едут они так далеко, что тебе и не представить. Чтобы не возиться с мелочью у стены, они позволяют искателям вроде тебя сопровождать отряд за небольшое вознаграждение. Сейчас для тебя каждый бронзовый на вес золота, а если повезёт, подкинут и вещицу какую.`,
    choices:[{t:'Далее', to:'master3_d'}]},
  master3_d: {
    needs:s=>!!s.flags.m3gear&&!s.flags.m3,
    grant:true,
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},
    resume:'guild_master',
    onEnter:s=>{
      if(!s.flags.m3gear||s.flags.m3)return;
      s.flags.m3=1;s.title='junior';
      return ['Новый титул: Младший Искатель','Новое задание: подойти к Рыцарю внутреннего двора'];
    },
    text:`— Подойди к рыцарю из внутреннего двора. Он обычно стоит в дальнем углу гильдии и отвечает за набор аколитов в сопровождение. Он скажет, что делать дальше.

Мастер-наставник отворачивается.

— Всё, ступай, аколит. С этой минуты ты мне не интересен. Да и не аколит ты больше.`,
    choices:[{t:'Выйти в зал', to:'guild_hall'}]},
  knight_a: {
    needs:s=>!!s.flags.m3,
    grant:true,
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.70, y:0.42, scale:1.9},   // приближаемся к рыцарю внутреннего двора
    resume:'guild_hall',
    onEnter:s=>{if(!s.flags.knight_met)s.flags.knight_met=1;},
    text:`Перед вами рыцарь в начищенных до блеска доспехах и белом плаще с гербом Стражей Агинды.`,
    choices:[
      {t:'Взять задание', to:'knight_take', if:s=>escortView(s)==='none'},
      {t:'Сдать молочный зуб', to:'knight_turnin', if:s=>escortView(s)==='won'&&(s.inv.troll_tooth||0)>0},
      {t:'Задание взято', to:'knight_a', if:s=>escortView(s)==='taken', dim:true, sub:'Отряд ждёт в Кривом переулке'},
      {t:'Задание провалено', to:'knight_a', if:s=>escortView(s)==='failed', dim:true, sub:'Новое можно взять завтра'},
      {t:'Задание выполнено', to:'knight_a', if:s=>escortView(s)==='done', dim:true, sub:'Новое можно взять завтра'},
      {t:'Назад', to:'guild_hall'},
    ]},
  knight_take: {
    needs:(s,ctx)=>!!s.flags.m3&&!escortTaken(s,ctx&&ctx.now),
    grant:true,
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.70, y:0.42, scale:1.9},   // приближаемся к рыцарю внутреннего двора
    resume:'guild_hall',
    onEnter:(s,ctx)=>{
      if(escortTaken(s,ctx&&ctx.now))return;
      s.daily=s.daily||{};s.daily.escort=dayNum(ctx&&ctx.now);s.daily.escortSt='taken';s.flags.knight_task=1;
      return ['Новое задание: сопроводить разведывательный отряд'];
    },
    text:`— Ступай в Кривой переулок, там увидишь разведывательный отряд. Выйди с ними за стену и возьми на себя мелочь, что болтается под ногами, чтобы отряд шёл дальше, не отвлекаясь. Как закончишь, приходи ко мне за наградой.`,
    choices:[{t:'Выйти в зал', to:'guild_hall'}]},
  knight_turnin: {
    needs:(s,ctx)=>dailyState(s,ctx&&ctx.now)==='won'&&(s.inv.troll_tooth||0)>0,
    grant:true,
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.70, y:0.42, scale:1.9},   // приближаемся к рыцарю внутреннего двора
    resume:'guild_hall',
    onEnter:(s,ctx)=>{
      if(dailyState(s,ctx&&ctx.now)!=='won'||(s.inv.troll_tooth||0)<1)return;
      s.inv.troll_tooth--;s.daily.escortSt='done';
      s.escortDone=(s.escortDone||0)+1;
      // TODO (доделать): шанс на вещицу в награду; пока бронза и стадии ожерелья
      gain(s,{gold:ESCORT_REWARD_BRONZE});
      const out=['Награда: +'+ESCORT_REWARD_BRONZE+' '+coinIcon()];
      SLAYER_STAGES.forEach(st=>{if(s.escortDone>=st.need&&!s.flags[st.flag]&&ITEMS[st.item]){
        s.flags[st.flag]=1;
        SLAYER_STAGES.forEach(o=>{if(o.item!==st.item&&s.inv[o.item]){delete s.inv[o.item];Object.keys(s.equip).forEach(k=>{if(s.equip[k]===o.item)s.equip[k]=null;});}});   // новая ступень заменяет старую
        gain(s,{item:st.item});s.equip.necklace=st.item;   // и надевается сама
        out.push('— И вот ещё. Ты это заслужил.','Получено: '+iconHtml(ITEMS[st.item])+' '+ITEMS[st.item].name+' (надето)');}});
      return out;
    },
    text:`Рыцарь берёт молочный зуб двумя пальцами, поворачивает к свету и коротко кивает.

— Годится. Отряд ушёл дальше без задержек. Держи, заслужил.`,
    choices:[{t:'Выйти в зал', to:'guild_hall'}]},
  escort_a: {
    place:'Кривой переулок',
    image:'pictures/locations/crooked-lane.jpg',
    imagePos:'center 45%',
    resume:'alley',
    text:`Вы подходите к двум рослым солдатам в кольчугах. По виду бывалые, за стеной не первый раз.

Прежде чем вы успеваете открыть рот, один из них с улыбкой спрашивает: «В сопровождение?»

— Отлично! Мы как раз выдвигаемся. Иди впереди отряда, и как только увидишь, что на нас бежит мелочь пузатая, отрезай им дорогу и вступай в бой. Твоя работа — чтобы наш отряд не отвлекался и шёл дальше. Всё понял? Вперёд!`,
    choices:[{t:'Далее', to:'escort_b'}]},
  escort_b: {
    place:'За стеной',
    image:'pictures/monsters/troll-cub-fat.jpg',
    imagePos:'center 45%',
    resume:'alley',
    text:s=>escortIntro(s),
    choices:[{t:'Начать бой', to:'escort_fight'}]},
  escort_fight: {
    place:'За стеной',
    combat:{ enemy:s=>escortFoes(s)[0], mode:'escort', resume:'alley',
      after:[{t:'В переулок', to:'alley'},{t:'Сдать зуб рыцарю в Гильдии', to:'guild_hall'}] }},
  master_gear: {
    needs:s=>!!s.flags.contract&&s.lvl>=2,   // условие награды (проверяет и сервер)
    grant:true,   // вход в сцену выдаёт награду: серверу отправляется действие scene
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},
    resume:'guild_master',
    onEnter:s=>{
      if(s.flags.gear)return;
      s.flags.gear=1;s.flags.belt_given=1;['helmet_cracked','boots_worn','belt_rag'].forEach(id=>gain(s,{item:id}));
      return ['Получено: '+['helmet_cracked','boots_worn','belt_rag'].map(id=>iconHtml(ITEMS[id])+' '+ITEMS[id].name).join(', ')+' (надеты)'];
    },
    text:`Вы идёте в дальний угол. Под рваным плащом лежат треснутый шлем, поношенные сапоги и тряпичный пояс. Хозяин за ними, похоже, уже не вернётся.`,
    choices:[
      {t:'Далее', to:'master_recipe', if:s=>!s.flags.recipe},
      {t:'Назад', to:'guild_master'},
    ]},
  master_recipe: {
    needs:s=>!!s.flags.contract,   // условие награды (проверяет и сервер)
    grant:true,   // вход в сцену выдаёт награду: серверу отправляется действие scene
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},
    resume:'guild_master',
    onEnter:s=>{
      if(s.flags.recipe)return;
      s.flags.recipe=1;gain(s,{item:'recipe_cloak_poor'});
      return ['Получено: '+iconHtml(ITEMS.recipe_cloak_poor)+' '+ITEMS.recipe_cloak_poor.name];
    },
    text:`— И вот ещё, держи. Самый простенький рецепт на плащ из крысиных шкур. Простые рецепты сотворят своё всегда, на то они и простые. Принеси шкур, сколько сказано, в лавку ремесленника в Кривом переулке — и плащ твой.`,
    choices:[{t:'Далее', to:'master_recipe2'},{t:'Назад', to:'guild_master'}]},
  master_recipe2: {
    place:'Гильдия искателей',
    image:'pictures/locations/seekers-guild.jpg',
    imagePos:'center 45%',
    zoom:{x:0.28, y:0.36, scale:2.0},
    resume:'guild_master',
    text:`— Простые рецепты продают ремесленники. А вот редкие падают с тварей, достаются за задания, а то и за особые заслуги. Эти капризны: бывает, портятся в работе, и остаётся тебе лишь кукиш с маслом. Зато если выйдет — каждый забулдыга в округе узнает и будет тебе завидовать.`,
    choices:[{t:'Назад', to:'guild_master'}]},

  city_center: {
    place:'Центральная площадь',
    title:'Центральная площадь',
    image:'pictures/locations/central-square.jpg',
    imagePos:'center 40%',
    text:`Булыжник стёрт тысячами ног. Меж лотков торгуются ремесленники, а над крышами высится стена внутреннего круга, за которой никто из вас не бывал.`,
    choices:[
      {t:'Гильдия искателей', to:'guild_hall'},
      {t:'Лавка: Богатый Искатель', to:'lavka'},
      {t:'Кривой переулок', to:'alley'},
      {t:'Деловой квартал', to:'quarter'},
      {t:'Городские катакомбы', to:'catacombs'},
    ]},

  quarter: {
    place:'Деловой квартал',
    title:'Деловой квартал',
    text:`Здесь внешний круг делает вид, что у него есть деньги. Писари за мутными окнами строчат расписки, ростовщики пересчитывают чужие долги, а торговцы спорят так громко, будто продают золото, а не лежалый товар. Все спешат, и никто никого не замечает.`,
    choices:[
      {t:'Харчевня «Последний ужин»', to:'tavern'},
      {t:'Вернуться на площадь', to:'city_center'},
    ]},
  tavern: {
    place:'Харчевня «Последний ужин»',
    title:'Харчевня «Последний ужин»',
    text:`Низкий зал, закопчённые балки, длинные столы, исцарапанные ножами. За стойкой хозяин мешает варево в огромном котле. На заднем дворе скрипит жёрнов: здесь мелют всё, что может превратиться в муку.`,
    choices:[
      {t:'Купить', to:'tavern_buy'},
      {t:'Приготовить', to:'tavern_cook'},
      {t:'Выйти в квартал', to:'quarter'},
    ]},
  tavern_buy: { place:'Харчевня «Последний ужин»', shop:true, stock:['rat_bread','recipe_rat_bread'], back:'tavern' },
  tavern_cook: { place:'Харчевня «Последний ужин»', cook:true, back:'tavern' },

  alley: {
    place:'Кривой переулок',
    image:'pictures/locations/crooked-lane.jpg',
    imagePos:'center 45%',
    text:`Переулок петляет между покосившимися стенами, под ногами хлюпает грязь. Из щелей между домами тянет зверем и железом. Здесь не любят праздных гостей.`,   // заглушка
    choices:[
      {t:'Разведывательный отряд (Задание)', to:'escort_a', if:s=>escortView(s)==='taken'},
      {t:'Дом ловцов и укротителей', to:'house'},
      {t:'Лавка ремесленника', to:'craft_shop'},
      {t:'Выход из города', to:'north_walls', if:s=>!!s.flags.m3},
      {t:'Выход из города', to:'north_locked', if:s=>!s.flags.m3},
      {t:'Вернуться на площадь', to:'city_center'},
    ]},
  north_locked: {
    place:'Выход из города',
    image:'pictures/locations/north-walls.jpg',
    imagePos:'center 45%',
    text:`Караульный у ворот отвешивает вам смачного пинка: «Выйдешь из города, когда станешь Младшим Искателем».`,
    choices:[{t:'Вернуться в переулок', to:'alley'}]},
  north_walls: {
    place:'Северные стены Агинды',
    image:'pictures/locations/north-walls.jpg',
    imagePos:'center 45%',
    title:'Северные стены Агинды',
    text:`Вы стоите у северных ворот Агинды. Подняв голову, можно увидеть, как лучники несут своё дежурство. Вдоль стен роются в помоях детёныши тролля-болотника в поисках еды. Лучникам нет дела ни до них, ни до взрослых троллей, что лениво бродят у болота «Марево» чуть севернее.`,
    choices:[
      {t:'Вернуться в город', to:'alley'},
      {t:'На север', to:'marsh_path', row:true, hint:'Пойти на Север'},
      {t:'На запад', soon:true, row:true, hint:'Пойти на Запад'},
      {t:'На восток', soon:true, row:true, hint:'Пойти на Восток'},
      {t:'Напасть на детёныша тролля-болотника', to:'north_fight'},
    ]},
  marsh_path: {
    place:'Тропа вдоль болота',
    image:'pictures/locations/marsh-path.jpg',
    title:'Тропа вдоль болота',
    text:`Продвигаясь вдоль болота «Марево», вы чувствуете ужасную вонь помоев и гниения. Бросив взгляд вглубь болота, вы замечаете источник вони: это тролли-болотники.`,
    choices:[
      {t:'Напасть на тролля-болотника', to:'marsh_encounter', if:s=>s.lvl>=4},
      {t:'Напасть на тролля-болотника', to:'marsh_locked', if:s=>s.lvl<4, dim:true, sub:'Нужен 4-й уровень'},
      {t:'На север', soon:true, row:true, hint:'Пойти на Север'},
      {t:'На запад', soon:true, row:true, hint:'Пойти на Запад'},
      {t:'На восток', soon:true, row:true, hint:'Пойти на Восток'},
      {t:'На юг', to:'north_walls', row:true, hint:'Вернуться к Северным стенам'},
    ]},
  marsh_locked: {
    place:'Тропа вдоль болота',
    image:'pictures/locations/marsh-path.jpg',
    text:`Вы вглядываетесь в болото: тролль огромен, от него несёт смертью и гнилью. Даже издали понятно, что до 4-го уровня сюда соваться нельзя.`,
    choices:[{t:'Назад', to:'marsh_path'}]},
  marsh_encounter: {
    place:'Тропа вдоль болота',
    image:'pictures/locations/marsh-path.jpg',
    onEnter:s=>{s.enc='troll_bog';},
    text:s=>`Из болота на тропу выбирается ${low(ENEMIES[s.enc].name)} (${enemyFor(s.enc,s.lvl).level} уровень). ${recPetLine(ENEMIES[s.enc])} Простая клеть-ловушка его не удержит.`,
    choices:[
      {t:'Напасть', to:'marsh_fight'},
      {t:'Бежать без оглядки', to:'marsh_path'},
    ]},
  marsh_fight: {
    place:'Тропа вдоль болота',
    combat:{ enemy:s=>s.enc, resume:'marsh_encounter',
      after:[{t:'Напасть ещё раз', to:'marsh_encounter'},{t:'Вернуться на тропу', to:'marsh_path'}] }},
  north_fight: {
    place:'Северные стены Агинды',
    combat:{ enemy:'troll_cub', resume:'north_walls',
      after:[{t:'Напасть ещё раз', to:'north_fight'},{t:'Вернуться к воротам', to:'north_walls'}] }},
  house: {
    place:'Дом ловцов и укротителей',
    image:'pictures/locations/catchers-house.jpg',
    text:`Один из самых элитных и загадочных домов внешнего круга. На первый этаж может попасть любой, а вот увидеть людей, бывавших на втором или тем более на третьем этаже, практически невозможно.`,
    choices:[
      {t:'1 этаж', to:'lovtsy1'},
      {t:'2 этаж', to:'house2'},
      {t:'3 этаж', to:'house3'},
      {t:'Выйти в переулок', to:'alley'},
    ]},
  house2: {
    place:'Дом ловцов · 2 этаж',
    text:`Дверь на лестницу заперта. Караульный даже не смотрит на вас:

— Сюда входят те, кто заслужил это кровью. Монстров и своей.`,
    choices:[{t:'Назад', to:'house'}]},
  house3: {
    place:'Дом ловцов · 3 этаж',
    text:`Лестница наверх перегорожена. Холод идёт откуда-то сверху.

— Туда ещё надо заслужить право подняться. Кровью. Чужой и своей.`,
    choices:[{t:'Назад', to:'house'}]},

  lovtsy1: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    text:`Просторный зал, в котором пахнет железом и зверем. По стенам висят пустые клети, где-то рычат, а у дальнего стола инструктор ловцов и укротителей что-то чинит.`,   // заглушка
    choices:[
      {t:'Поговорить с инструктором', to:'lovtsy_i1', if:s=>!s.flags.cage_gift},
      {t:'Поговорить с инструктором', to:'lovtsy_again', if:s=>s.flags.cage_gift},
      {t:'Синергия', to:'lovtsy_syn'},
      {t:'Продать питомца', to:'lovtsy_sell', if:s=>(s.pets||[]).some(p=>p.id!==s.pet)},
      {t:'Воскресить питомца', to:'lovtsy_res_a', if:s=>(s.pets||[]).some(p=>p.dead)},
      {t:'Назад', to:'house'},
    ]},
  lovtsy_again: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    text:`— Клеть при тебе? Тогда чего стоишь? Хочешь повторить урок — повторим.`,
    choices:[
      {t:'Повторить инструктаж', to:'lovtsy_i1'},
      {t:'Назад', to:'lovtsy1'},
    ]},
  lovtsy_i1: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    text:`Инструктор ловцов и укротителей чинит прут клети и, не поднимая глаз, бросает:

— Новичок? Слушай один раз. Клеть — не просто железо. В ней сила, которой нас не учили. Откуда она — не наше дело. Наше дело — ею пользоваться.`,
    choices:[{t:'Дальше', to:'lovtsy_i2'},{t:'Уйти', to:'lovtsy1'}]},
  lovtsy_i2: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    text:`— Ловить можно раз за бой. Бросок клети заменяет твой удар, но блок ставить можно. Зверя до пятого уровня клеть берёт через раз. Доведи его до издыхания — шанс поимки увеличится. Каждый твой уровень ловца — ещё один из ста. Выше девяноста не будет.`,
    choices:[{t:'Дальше', to:'lovtsy_i3'},{t:'Уйти', to:'lovtsy1'}]},
  lovtsy_i3: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    text:`— Сорвалось — зверь взбесится: до конца боя он сильнее. А мелочь, что ниже тебя на два уровня и больше, мастерства ловца не прибавит. Не трать на пустяки время.`,
    choices:[{t:'Дальше', to:'lovtsy_i4'},{t:'Уйти', to:'lovtsy1'}]},
  lovtsy_i4: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    text:`— Пойманный зверь станет твоим питомцем. Но клеть усмиряет его и ослабляет: сила вдвое меньше, ранг D. Сведи двух одного вида и ранга — получишь ранг выше. На ранге А сила вернётся вся.`,
    choices:[{t:'Дальше', to:'lovtsy_i5'},{t:'Уйти', to:'lovtsy1'}]},
  lovtsy_i5: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    text:`— В бою питомец принимает на себя половину каждого удара. Просел ниже тридцати из ста — отводи, пока не погиб. О павших поговорим, когда заслужишь. Держи клеть.`,
    choices:[
      {t:'Взять клеть', to:'lovtsy_gift', if:s=>!s.flags.cage_gift},
      {t:'Назад', to:'lovtsy1', if:s=>s.flags.cage_gift},
    ]},
  lovtsy_gift: {
    needs:s=>!!s.flags.contract,   // условие награды (проверяет и сервер)
    grant:true,   // вход в сцену выдаёт награду: серверу отправляется действие scene
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    resume:'lovtsy1',
    onEnter:s=>{
      if(s.flags.cage_gift)return;
      s.flags.cage_gift=1;gain(s,{item:'cage_simple'});
      return ['Получено: '+iconHtml(ITEMS.cage_simple)+' '+ITEMS.cage_simple.name+' (надета)'];
    },
    text:`Инструктор, не глядя, бросает вам клеть. Она холодная, и прутья едва заметно гудят.

— Простая. Лучшие — потом, и не даром.`,
    choices:[{t:'Назад', to:'lovtsy1'}]},
  lovtsy_res_a: {
    place:'Дом ловцов · 1 этаж',
    image:'pictures/locations/catchers-instructor.jpg',
    imagePos:'center 45%',
    zoom:{x:0.64, y:0.38, scale:2.0},   // приближаемся к инструктору ловцов
    text:`— Угробил питомца? Запомни: после приручения это уже не монстр, а друг, готовый отдать за тебя жизнь и кромсать своих бывших сородичей. Если видишь, что питомец на последнем издыхании, уведи его за спину, дай отдохнуть.

Хочешь сразу — плати, и он встанет на ноги. Монет нет — оставь его мне и жди. Чем зверь сильнее, тем дольше с ним возиться и тем дороже выйдет.`,
    choices:[{t:'Отдать питомца', to:'lovtsy_revive'},{t:'Назад', to:'lovtsy1'}]},
  lovtsy_revive: { place:'Дом ловцов · 1 этаж', revive:true, back:'lovtsy1' },
  lovtsy_syn: { place:'Дом ловцов · 1 этаж', synergy:true, back:'lovtsy1' },
  lovtsy_sell: { place:'Дом ловцов · 1 этаж', petsell:true, back:'lovtsy1' },

  craft_shop: {
    place:'Лавка ремесленника',
    image:'pictures/locations/craft-shop.jpg',
    imagePos:'center 38%',
    text:`В лавке пахнет кожей, смолой и свежей стружкой. За верстаком, вытирая руки о фартук, стоит молодая ремесленница: тёмная коса, лукавая улыбка и пятнышко сажи на щеке.`,   // заглушка
    choices:[
      {t:'Подойти к ремесленнице', to:'craft_talk'},
      {t:'Выйти в переулок', to:'alley'},
    ]},
  craft_talk: {
    place:'Лавка ремесленника',
    image:'pictures/locations/craft-shop.jpg',
    imagePos:'center 38%',
    zoom:{x:0.53, y:0.36, scale:2.1},   // подошли к ремесленнице
    text:`Она поднимает глаза и подмигивает:

— Что будем мастерить?`,
    choices:[
      {t:'Создать', to:'craft_make'},
      {t:'Купить рецепты', to:'craft_buy'},
      {t:'Назад', to:'craft_shop'},
    ]},
  craft_buy: { place:'Лавка ремесленника', shop:true, stock:['recipe_rat_king_belt'], back:'craft_talk',
    image:'pictures/locations/craft-shop.jpg', imagePos:'center 38%', zoom:{x:0.53, y:0.36, scale:2.1},
    text:'Ремесленница вытирает руки и достаёт из-под прилавка свёрнутые листы: — Простые рецепты, без подвохов. Сто бронзовых за лист, и я не торгуюсь.' },
  craft_make: { place:'Лавка ремесленника', craft:true, back:'craft_talk',
    image:'pictures/locations/craft-shop.jpg', imagePos:'center 38%', zoom:{x:0.53, y:0.36, scale:2.1} },

  lavka: {
    place:'Лавка: Богатый Искатель',
    image:'pictures/locations/lavka-rich-seeker.jpg',
    imagePos:'center 45%',
    text:`В названии «Богатый Искатель» нет ни капли правды. У хозяина глазки так малы, что их почти нет, а шея так необъятна, что для неё не найти петли во всём городе.

Вы подходите и со вздохом говорите:`,
    choices:[
      {t:'Продам', to:'lavka_sell'},
      {t:'Куплю', to:'lavka_buy'},
      {t:'Выйти на площадь', to:'city_center'},
    ]},
  lavka_buy: { place:'Лавка: Богатый Искатель', shop:true, stock:['potion','potion_mid','potion_big','ring_pioneer'], back:'lavka',
    text:'Хозяин кивает на полку: — Без торга и без скидок.' },
  lavka_sell: { place:'Лавка: Богатый Искатель', sell:true, back:'lavka' },

  catacombs: {
    place:'Городские катакомбы',
    image:'pictures/locations/city-catacombs.jpg',
    title:'Городские катакомбы',
    text:`Каменная лестница уходит во тьму. Снизу тянет холодом и слабым писком. Старые подземные ходы уходят вниз ярус за ярусом и ждут тех, кто осмелится спуститься.`,
    choices:[
      {t:'1 этаж', to:'cat1_encounter'},
      {t:'2 этаж', to:'cat2_encounter', if:s=>s.flags.gear},
      {t:'2 этаж', to:'cat2_locked', if:s=>!s.flags.gear, dim:true, sub:'Наставник советовал пока сюда не соваться'},
      {t:'3 этаж', to:'cat3_encounter', if:s=>s.lvl>=4},
      {t:'3 этаж', to:'cat3_locked', if:s=>s.lvl<4, dim:true, sub:'Оттуда доносится скрежет чего-то огромного'},
      {t:'Вернуться на площадь', to:'city_center'},
    ]},

  cat1_encounter: {
    place:'Городские катакомбы · 1 этаж',
    image:'pictures/locations/city-catacombs.jpg',
    zoom:{x:0.54, y:0.51, scale:1.9},   // спускаемся на этаж: приближаем кадр к тоннелю
    title:'Городские катакомбы · 1 этаж',
    onEnter:s=>{s.enc=pick(FLOORS.cat1);},
    text:s=>`На вас с ненавистью смотрит ${low(ENEMIES[s.enc].name)} (${enemyFor(s.enc,s.lvl).level} уровень).`,
    choices:[
      {t:'Напасть', to:'cat1_fight'},
      {t:'Бежать без оглядки', to:'catacombs'},
    ]},
  cat1_fight: {
    place:'Городские катакомбы · 1 этаж',
    combat:{ enemy:s=>s.enc, resume:'cat1_encounter',
      after:[{t:'Искать дальше', to:'cat1_encounter'},{t:'Вернуться на площадь', to:'city_center'}] }},

  cat2_locked: {
    place:'Городские катакомбы',
    image:'pictures/locations/city-catacombs.jpg',
    text:`Перед лестницей высится гора костей — человеческих и крысиных вперемешку. Без слов ясно: соваться сюда ещё рано.`,
    choices:[{t:'Назад', to:'catacombs'}]},
  cat2_encounter: {
    place:'Городские катакомбы · 2 этаж',
    image:'pictures/locations/city-catacombs.jpg',
    zoom:{x:0.54, y:0.51, scale:2.6},   // спускаемся глубже: приближаем тот же кадр сильнее, чем на 1-м этаже
    onEnter:s=>{s.enc=pick(FLOORS.cat2);},
    text:s=>`На вас с ненавистью смотрит ${low(ENEMIES[s.enc].name)} (${enemyFor(s.enc,s.lvl).level} уровень).`,
    choices:[
      {t:'Напасть', to:'cat2_fight'},
      {t:'Бежать без оглядки', to:'catacombs'},
    ]},
  cat3_locked: {
    place:'Городские катакомбы',
    image:'pictures/locations/city-catacombs.jpg',
    text:`Дальше лестница уходит в такую глубину, что оттуда тянет не холодом, а чем-то живым и огромным. Слышен скрежет, будто что-то точит клыки о камень. Сюда пока лучше не спускаться: нужен хотя бы 4-й уровень.`,
    choices:[{t:'Назад', to:'catacombs'}]},
  cat3_encounter: {
    place:'Городские катакомбы · 3 этаж',
    image:'pictures/locations/city-catacombs.jpg',
    zoom:{x:0.54, y:0.51, scale:3.2},   // самый глубокий уровень: приближаем тот же кадр ещё сильнее
    onEnter:s=>{s.enc=pick(FLOORS.cat3);},
    text:s=>`Из мрака на вас смотрит ${low(ENEMIES[s.enc].name)} (${enemyFor(s.enc,s.lvl).level} уровень). Он очень силён: без подходящего питомца вам не справиться. ${recPetLine(ENEMIES[s.enc])}`,
    choices:[
      {t:'Напасть', to:'cat3_fight'},
      {t:'Бежать без оглядки', to:'catacombs'},
    ]},
  cat3_fight: {
    place:'Городские катакомбы · 3 этаж',
    combat:{ enemy:s=>s.enc, resume:'cat3_encounter',
      after:[{t:'Напасть ещё раз', to:'cat3_encounter'},{t:'Вернуться на площадь', to:'city_center'}] }},
  cat2_fight: {
    place:'Городские катакомбы · 2 этаж',
    combat:{ enemy:s=>s.enc, resume:'cat2_encounter',
      after:[{t:'Искать дальше', to:'cat2_encounter'},{t:'Вернуться на площадь', to:'city_center'}] }},
};

