// Проверка ника: формат, зарезервированные слова, мат и запретные слова (RU + EN, с обходами).
// ВАЖНО: это проверка на стороне игрока, её можно обойти. Настоящая проверка и уникальность — на сервере (этап «Б»).
// Списки — основы слов (подстрока после нормализации). Если ловит лишнее — добавьте слово в NICK_ALLOW.
const NICK_RULES = { min:3, max:16 };

const NICK_BAD_RU = [   // мат, оскорбления, экстремизм (основы, нижний регистр, ё → е)
  'хуй','хуе','хуи','хуя','хую','пизд','пезд','ебан','ебат','ебал','ебуч','ебну','еблан','ебло','заеб','уеб','выеб','наеб',
  'бляд','блят','блеат','сука','суки','мудак','мудил','мудо','пидор','пидар','пидр','гандон','гондон','залуп','шлюх','манда',
  'дроч','жоп','говн','сран','дерьм','гитлер','нацист','фашист','порно',
];
const NICK_BAD_EN = [
  'fuck','fuk','shit','bitch','cunt','dick','cock','pussy','nigg','fagg','whore','slut','rapist','nazi','hitler','porn',
  'xyu','xui','xuy','hui','pizd','blyat','blyad','suka','mudak','eban','ebat','ebal','zalup','gandon','pidor','pidar','pidr','gavno','mudil',   // транслит русского мата
];
const NICK_ALLOW = ['скипидар','хуан','хуанг','мандарин','mandarin','cocktail','cockpit','peacock','hancock','scunthorpe','therapist',
  'команд','мандат','спорно','спорн','оскорбл','страна','странн','застрах','дроче','ресурс'];   // слова с безобидным вхождением основ
const NICK_RESERVED = [   // роли, имена NPC, служебные слова (нельзя занимать)
  'админ','admin','модератор','moderator','поддержка','support','telegram','телеграм','агинда','aginda',
  'мастернаставник','наставник','инструктор','ремесленниц','караульн','системн',
];

// Обходы: похожие буквы (латиница ↔ кириллица), транслит и цифры-замены
const _VIS = {a:'а',b:'в',c:'с',e:'е',h:'н',k:'к',m:'м',o:'о',p:'р',t:'т',x:'х',y:'у'};                 // латиница выглядит как кириллица
const _PHO = {a:'а',b:'б',c:'к',d:'д',e:'е',f:'ф',g:'г',h:'х',i:'и',j:'й',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'к',r:'р',s:'с',t:'т',u:'у',v:'в',w:'в',x:'х',y:'у',z:'з'};   // транслит
const _DIG_RU = {'0':'о','1':'и','3':'з','4':'а','6':'б','8':'в','@':'а'};
const _C2L = {а:'a',в:'b',с:'c',е:'e',н:'h',к:'k',м:'m',о:'o',р:'p',т:'t',х:'x',у:'y',и:'i',г:'r',д:'d',з:'z',л:'l',ш:'w',ф:'f',й:'j',б:'b',п:'p'};
const _DIG_EN = {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s'};
const _lower=s=>s.toLowerCase().replace(/ё/g,'е');
const _strip=s=>s.replace(/[^a-zа-я]/g,'');
// варианты ника «в кириллице»: внешнее сходство и транслит
const nickRuVariants=s=>[_VIS,_PHO].map(m=>_strip([..._lower(s)].map(ch=>_DIG_RU[ch]||m[ch]||ch).join('')));
// ник «в латинице» (для английских слов)
const nickEn=(s,lAsI)=>_strip([..._lower(s)].map(ch=>_DIG_EN[ch]||(lAsI&&ch==='l'?'i':_C2L[ch])||ch).join(''));
const nickEnVariants=s=>[true,false].map(k=>nickEn(s,k));   // l как i (shlt → shit) и как l

// Есть ли в слове мат или запретное слово (с обходами). Используется и для ников, и для чата (по словам).
function nickHasBad(n){
  let ru=nickRuVariants(n),en=nickEnVariants(n);
  NICK_ALLOW.forEach(a=>{const ar=nickRuVariants(a);ru=ru.map((v,i)=>v.split(ar[i]).join(''));const ae=nickEnVariants(a);en=en.map((v,i)=>v.split(ae[i]).join(''));});
  return ru.some(v=>NICK_BAD_RU.some(w=>v.includes(w)))||NICK_BAD_EN.some(w=>en.some(v=>v.includes(w)));
}

// Возвращает {ok, msg}. Проверка уникальности между игроками появится на сервере.
function checkNick(raw){
  const n=(raw||'').trim();
  if(n.length<NICK_RULES.min)return {ok:false,msg:`Минимум ${NICK_RULES.min} символа.`};
  if(n.length>NICK_RULES.max)return {ok:false,msg:`Не больше ${NICK_RULES.max} символов.`};
  if(!/^[A-Za-zА-Яа-яЁё0-9_]+$/.test(n))return {ok:false,msg:'Только буквы, цифры и подчёркивание, без пробелов.'};
  if(/^[0-9_]+$/.test(n))return {ok:false,msg:'В нике должны быть буквы.'};
  if(nickHasBad(n))return {ok:false,msg:'Недопустимое слово. Выберите другой ник.'};
  const rr=nickRuVariants(n),re=nickEnVariants(n);
  if(NICK_RESERVED.some(w=>{const wr=nickRuVariants(w);const we=nickEnVariants(w);return rr.some((v,i)=>v.includes(wr[i]))||re.some((v,i)=>v.includes(we[i]));}))return {ok:false,msg:'Этот ник зарезервирован.'};
  return {ok:true,msg:''};
}
