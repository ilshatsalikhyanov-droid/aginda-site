const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); try{tg.setHeaderColor('#fffdf5'); tg.setBackgroundColor('#fbf3de');}catch(e){} }

// Высота области мини-приложения (Telegram отдаёт реальную видимую высоту)
const setH=()=>document.documentElement.style.setProperty('--app-h',((tg&&tg.viewportStableHeight)||window.innerHeight)+'px');
setH();window.addEventListener('resize',setH);try{tg?.onEvent('viewportChanged',setH);}catch(e){}
const $screen = document.getElementById('screen');
const $hud = document.getElementById('hud');
const SAVE_KEY = 'ash_save_v2';   // v2 — рестарт демо: старые сохранения не подхватываются
let S = null;          // состояние игрока
let C = null;
let inFight = false;   // идёт бой — инвентарь и меню недоступны          // текущий бой

// ---------- сохранение ----------
const cloud = !serverOn() && tg && tg.initData && tg.isVersionAtLeast?.('6.9') ? tg.CloudStorage : null;   // с сервером облако Telegram не нужно (лимит 4096 символов)
const local = ()=>{try{return localStorage.getItem(SAVE_KEY);}catch(e){return null;}};
const store = {
  get(cb){
    let done=false;const once=v=>{if(!done){done=true;cb(v);}};
    if (serverOn()) {   // сервер: сравнить с локальным; если связи нет дольше 3,5 с — играем локально
      const lv=local();setTimeout(()=>once(lv),3500);
      serverCall('load').then(r=>{if(r.status===200&&r.admin)serverAdmin=true;checkBuild(r);once(resolveSave(lv,r));if(serverAdmin&&S)hud();});return;
    }
    if (cloud) { try{ setTimeout(()=>once(local()),3000); cloud.getItem(SAVE_KEY,(e,v)=>once(!e&&v?v:local())); return; }catch(e){} }
    once(local());
  },
  set(v){
    try{localStorage.setItem(SAVE_KEY,v);}catch(e){}
    try{cloud?.setItem(SAVE_KEY,v);}catch(e){}
  },
  clear(){ try{localStorage.removeItem(SAVE_KEY);}catch(e){} try{cloud?.removeItem(SAVE_KEY);}catch(e){}
    if(serverOn()){serverCall('wipe');sync.rev=0;sync.dirty=false;saveSync();} },
};
// Действие с экономикой: сразу на экране (те же функции, что на сервере) + в очередь серверу
function doOp(op){const r=applyOp(S,op,{admin:isAdmin(),now:Date.now()});if(r.ok){queueOp(op);save();hud();}return r;}
const save = () => { if(!S)return; store.set(JSON.stringify(S)); markDirty(); };

// ---------- хелперы ----------
const rnd = (a,b)=>a+Math.floor(Math.random()*(b-a+1));
const mk=(cls,h='')=>{const d=document.createElement('div');d.className=cls;d.innerHTML=h;return d;};
const el = (h)=>{const d=document.createElement('div');d.innerHTML=h;return d;};
function btn(label,fn,cls='',sub=''){
  const b=document.createElement('button');b.className='btn '+cls;
  b.innerHTML=label+(sub?`<small>${sub}</small>`:'');b.onclick=()=>{tg?.HapticFeedback?.selectionChanged();fn();};return b;
}
// Значок предмета: картинка (поле img) или эмодзи (поле icon)
const iic=iconHtml;   // значок предмета: картинка или эмодзи (core.js)
const itemLabel=it=>`${it.name}${it.quest?' <span class="tag">задание</span>':''}${it.junk?' <span class="tag">хлам</span>':''}${it.material?' <span class="tag">материал</span>':''}${it.recipe?` <span class="tag">${it.recipe.tier}</span>`:''}${it.cook?` <span class="tag">${it.cook.tier}</span>`:''}`;
const itemName=it=>`${iic(it)} ${itemLabel(it)}`;
const coinChip=s=>['gold_coin','silver_coin'].filter(k=>s.inv[k]).map(k=>`${iic(ITEMS[k])}${s.inv[k]}`).concat(iic(ITEMS.bronze_coin)+(s.inv.bronze_coin||0)).join(' ');
const pick=a=>a[Math.floor(Math.random()*a.length)];
function regenHp(s){regenHpAt(s,Date.now(),inFight);}
const score=it=>Object.values(it.bonus||{}).reduce((a,b)=>a+b,0);

// ---------- HUD ----------
const ICON={
  person:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></svg>',
  bag:'<svg viewBox="0 0 24 24"><path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  chat:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
};
// Админ-инструменты (↻ ▲ ▼, +/− у предметов, каталог) видны только в тестовых версиях:
// см. env.js: локально, в открытом файле и в тестовой сборке (dev). В основной (main) их нет.
let serverAdmin=false;   // сервер подтвердил админа (его id хранится в секрете ADMIN_IDS на сервере, в коде его нет)
const isAdmin=()=>serverAdmin||isTestBuild();
const inLocalFightUI=()=>inFight&&C&&C.ui&&C.ui.hpFill;
function adminRestore(){
  if(inLocalFightUI()){   // в бою: здоровье героя и питомца; сервер узнаёт об этом из выбора на следующем раунде (только для админа)
    combatRestore(C,S);C.restoreFlag=true;C.log.push(ld('Админ: здоровье героя и питомца восстановлено.'));
    refreshCombat();return;
  }
  doOp({op:'admin_restore'});hud();
}
function adminLevel(d){
  doOp({op:'admin_level',d});
  if(inLocalFightUI())refreshCombat();else hud();
}
const titlesUnlocked=s=>Object.keys(TITLES).filter(k=>TITLES[k].has(s));
const titleOf=titleNameOf;
function iconBtn(svg,label,fn){const b=document.createElement('button');b.className='ib';b.innerHTML=svg;b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;return b;}

// Верхняя панель: слева уровень, по центру титул, справа пока пусто; ниже — ресурсы и иконки.
function hud(){
  if(!S){$hud.innerHTML='';return;}
  regenHp(S);
  const hp=Math.max(0,S.hp),mh=maxHp(S);
  // в бою верхней строки нет: уровень и имя врага уже есть в окне врага, место отдано картинке и логу; отступы шапки и экрана ужаты
  $hud.classList.toggle('infight',!!inFight);$screen.classList.toggle('infight',!!inFight);
  $hud.innerHTML=`${inFight?'':`<div class="hrow top"><div class="pill lvl">Ур.<b>${S.lvl}</b></div><div class="pill title">${SCENES[S.scene]?.place||SCENES[S.scene]?.title||''}</div><div class="pill ghost"></div></div>`}
  <div class="hrow bottom"><div class="chips"><span class="chip hp">❤ ${hp}<span class="mx">/${mh}</span></span><span class="chip st" title="${stam(S)<maxStam(S)?'До полной выносливости: '+waitText(stamWaitMin(S,maxStam(S))):'Выносливость полная'}">⚡ ${stam(S)}<span class="mx">/${maxStam(S)}</span></span><span class="chip co">${coinChip(S)}</span></div><button type="button" class="qtask" aria-label="Журнал заданий"></button><div class="icons"></div></div>
  ${inFight?'':`<i class="xpline" style="width:${S.xp/xpNeed(S)*100}%"></i>`}`;
  if(isAdmin()){
    const g=$hud.querySelector('.pill.ghost'),grp=document.createElement('div');grp.className='adm-group';
    const ab=(txt,title,fn)=>{const b=document.createElement('button');b.className='pill adm';b.type='button';b.textContent=txt;b.title=title;b.setAttribute('aria-label',title);
      b.onclick=()=>{fn();b.classList.add('ok');setTimeout(()=>b.classList.remove('ok'),500);};return b;};
    grp.append(ab('↻','Восстановить здоровье и выносливость',adminRestore));
    if(!inFight)grp.append(ab('▲','Уровень +1',()=>adminLevel(1)),ab('▼','Уровень −1',()=>adminLevel(-1)));   // уровень в бою не меняем
    if(inFight)$hud.querySelector('.icons').append(grp);   // в бою — справа в строке ресурсов (там, где вне боя иконки меню)
    else g.replaceWith(grp);
  }
  if(!inFight)$hud.querySelector('.icons').append(
    iconBtn(ICON.menu,'Меню',()=>menu()),
    iconBtn(ICON.chat,'Чат',()=>chatScreen(S.scene)),   // инвентарь — в окне «Персонаж»
    iconBtn(ICON.person,'Персонаж',()=>characterScreen(S.scene)));
  // активное задание: в свободном месте между ресурсами и иконками (если места нет — скрыто); нажатие открывает журнал
  const hb=$hud.querySelector('.hrow.bottom'),qt=hb.querySelector('.qtask'),acts=activeTasks(S);
  if(acts.length&&!inFight){const at=acts[qIdx%acts.length];qt.innerHTML='<i>●</i> '+at.short;qt.onclick=()=>journalScreen(S.scene);qt.title='Активное задание: '+at.t;}else qt.remove();
  // не помещается (много видов монет) — прячем максимумы здоровья и выносливости, затем задание
  hb.classList.remove('tight');
  if(hb.scrollWidth>hb.clientWidth+1)hb.classList.add('tight');
  if(qt.isConnected&&qt.clientWidth<70)qt.style.visibility='hidden';
}

// Приближение картинки к точке (x, y — доли исходной картинки): «мы подошли ближе».
// Считаем по реальной раскладке (object-fit: cover), поэтому точка попадает в центр на любом экране.
let lastZoomInfo=null;   // {image, zoom} последней приближенной страницы: нужен для «отдаления» при возврате
let lastZoomKey=null;   // ключ последнего показанного приближения: на соседней странице с тем же приближением анимации нет
// Точка приближения: окно просмотра не должно выходить за картинку (иначе по бокам видны полосы), поэтому центр сдвигается внутрь
function zoomPoint(w,h,ox,oy,dw,dh,z){
  const hx=w/(2*z.scale),hy=h/(2*z.scale);
  return [Math.min(Math.max(ox+z.x*dw,hx),w-hx),Math.min(Math.max(oy+z.y*dh,hy),h-hy)];
}
function setupZoom(img,sc,still){
  const z=sc.zoom,box=img.parentNode;
  const [px,py]=(sc.imagePos||'center 35%').match(/[\d.]+%|center/g).map(v=>v==='center'?.5:parseFloat(v)/100);
  const apply=animate=>{
    const w=box.clientWidth,h=box.clientHeight,W=img.naturalWidth,H=img.naturalHeight;
    if(!W||!w)return;
    const s=Math.max(w/W,h/H),dw=W*s,dh=H*s,ox=(w-dw)*px,oy=(h-dh)*py,[mx,my]=zoomPoint(w,h,ox,oy,dw,dh,z);
    img.style.transformOrigin=`${mx}px ${my}px`;
    img.style.transition=animate?'transform .9s cubic-bezier(.22,.61,.36,1)':'none';
    img.style.transform=`translate(${w/2-mx}px,${h/2-my}px) scale(${z.scale})`;
  };
  img._zoom=()=>apply(false);
  const start=()=>{if(still){apply(false);return;}img.style.transition='none';img.style.transform='none';void img.offsetWidth;setTimeout(()=>apply(!matchMedia('(prefers-reduced-motion: reduce)').matches),30);};
  if(img.complete&&img.naturalWidth)start();else img.addEventListener('load',start,{once:true});
}
// Отдаление: на странице с той же картинкой без приближения кадр плавно возвращается из приближенного вида (кнопка «Назад»)
function setupUnzoom(img,sc,prev){
  const z=prev.zoom,box=img.parentNode;
  const [px,py]=(sc.imagePos||'center 35%').match(/[\d.]+%|center/g).map(v=>v==='center'?.5:parseFloat(v)/100);
  const run=()=>{
    const w=box.clientWidth,h=box.clientHeight,W=img.naturalWidth,H=img.naturalHeight;
    if(!W||!w)return;
    const s=Math.max(w/W,h/H),dw=W*s,dh=H*s,ox=(w-dw)*px,oy=(h-dh)*py,[mx,my]=zoomPoint(w,h,ox,oy,dw,dh,z);
    img.style.transformOrigin=`${mx}px ${my}px`;img.style.transition='none';
    img.style.transform=`translate(${w/2-mx}px,${h/2-my}px) scale(${z.scale})`;   // начало: как на приближенной странице
    void img.offsetWidth;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){img.style.transform='none';return;}
    setTimeout(()=>{img.style.transition='transform .9s cubic-bezier(.22,.61,.36,1)';img.style.transform='none';},30);
  };
  if(img.complete&&img.naturalWidth)run();else img.addEventListener('load',run,{once:true});
}
window.addEventListener('resize',()=>document.querySelectorAll('img[data-zoom]').forEach(i=>i._zoom&&i._zoom()));

// ---------- экраны ----------
// auto=true — при запуске: если есть сохранение, сразу входим в игру, минуя стартовую страницу
function menu(auto=false){
  lastZoomKey=null;lastZoomInfo=null;clearTimer();S=null;hud();
  store.get(v=>{
    if(auto&&v){try{S=JSON.parse(v);return go(S.scene||'guild_hall');}catch(e){S=null;store.clear();v=null;}}
    $screen.innerHTML='';
    const page=mk('page'),act=mk('actions');
    page.append(mk('scene-img',`<img src="${pic('pictures/main-menu.jpg')}" alt="" style="object-position:center 30%" onerror="this.parentNode.remove()">`));
    page.append(mk('body',`<h1>АГИНДА</h1><div class="text">
      <p>Материк Агинды омывают моря. Единственное известное людям поселение — город за двумя кольцами высоких стен.</p>
      <p>Во внутреннем круге — тайна, во внешнем — нищета и труд, а за стенами хозяйничают твари. Чаще других туда выходят искатели — за добычей. Твой путь начинается сегодня.</p></div>`));
    if(v){
      const c=btn('Продолжить','','primary');
      c.onclick=()=>{try{S=JSON.parse(v);go(S.scene||'guild_hall');}catch(e){store.clear();menu();}};
      act.append(c);
    }
    // Персонаж создаётся один раз; дальше — только «Продолжить»
    if(!v)act.append(btn('Войти в дивный и ужасный мир Агинды',registerScreen,'primary'));
    if(v&&isAdmin())act.append(btn('Админ: создать нового героя (сбросит сохранение)',()=>{if(confirm('Стереть сохранение и создать нового героя?')){store.clear();registerScreen();}},'dimmed'));
    page.append(act);$screen.append(page);
  });
}
function newGame(cls,profile={}){
  const c=CLASSES[cls];
  S={cls,name:profile.name||tg?.initDataUnsafe?.user?.first_name||'Странник',gender:profile.gender||'n',birth:profile.birth||null,
     lvl:1,xp:0,base:{...c.stats},hp:c.stats.hp,hpAt:Date.now(),inv:{},equip:{},flags:{},scene:'guild_hall'};
  go('guild_hall');
}

// ---- Создание героя: ник (проверка формата и запретных слов), пол (влияет на картинку), дата рождения по желанию ----
// Уникальность ника между игроками будет проверяться на сервере (этап Б). Почту пока не собираем.
function registerScreen(){
  S=null;hud();clearTimer();lastZoomKey=null;
  if(!serverOn())return registerForm();
  // с сервером: сначала смотрим, не зарегистрирован ли этот аккаунт Telegram (новый телефон, переустановка)
  $screen.innerHTML='';$screen.append(el('<h2>Создание героя</h2>'),el('<p class="dim">Проверяем профиль…</p>'));
  serverCall('me').then(r=>{
    if(r.status===200&&r.player)return newGame('seeker',{name:r.player.nick,gender:r.player.gender,birth:r.player.birth});
    if(r.status===200)return registerForm();
    $screen.innerHTML='';$screen.append(el('<h2>Нет связи</h2>'),el(`<p class="text">${r.status===401?'Не удалось подтвердить аккаунт Telegram. Откройте игру через Telegram.':'Сервер недоступен. Проверьте подключение и попробуйте ещё раз.'}</p>`));
    $screen.append(btn('Повторить',registerScreen,'primary'),btn('← Назад',menu));
  });
}
function registerForm(){
  $screen.innerHTML='';
  const st={gender:null,okNick:null,busy:false,tok:0},page=mk('page reg'),body=mk('body','<h2>Создание героя</h2>');
  const fld=(label,node,hintCls)=>{const w=mk('field',`<label class="flab">${label}</label>`);w.append(node);const h=mk('fhint '+(hintCls||''));w.append(h);return [w,h];};
  const nick=document.createElement('input');nick.className='fld';nick.type='text';nick.maxLength=NICK_RULES.max;nick.placeholder='Ваш ник';
  nick.autocomplete='off';nick.autocapitalize='off';nick.spellcheck=false;
  const tgName=(tg?.initDataUnsafe?.user?.first_name||'').trim();
  if(tgName&&checkNick(tgName).ok)nick.value=tgName;   // подсказка из Telegram
  const [nickW,nickH]=fld('Ник',nick);
  const g=mk('gchoices');
  [['m','Мужской'],['f','Женский'],['n','Не указывать']].forEach(([k,label])=>{
    const b=document.createElement('button');b.type='button';b.className='gbtn';b.textContent=label;
    b.onclick=()=>{st.gender=k;refresh(true);};b.dataset.g=k;g.append(b);
  });
  const gW=mk('field',`<label class="flab">Пол</label>`);gW.append(g);
  const dob=document.createElement('input');dob.className='fld';dob.type='date';dob.min='1900-01-01';dob.max=new Date().toISOString().slice(0,10);
  const [dobW,dobH]=fld('Дата рождения <span class="dim">(по желанию)</span>',dob);
  const note=mk('fnote',serverOn()?'Ник проверяется на сервере: он должен быть уникальным и без запретных слов. Профиль привязан к вашему аккаунту Telegram.':'Данные хранятся только на вашем устройстве и в облаке Telegram. Проверка уникальности ника между игроками появится позже, вместе с общим сервером.');
  body.append(nickW,gW,dobW,note);page.append(body);
  const act=mk('actions'),go_=btn('Начать путь',submit,'primary');
  act.append(go_,btn('← Назад',menu));page.append(act);$screen.append(page);

  let timer=null;
  function setHint(txt,cls){nickH.textContent=txt;nickH.className='fhint '+(cls||'');}
  async function serverCheck(){   // проверка ника на сервере (занят ли), с защитой от устаревших ответов
    const v=nick.value.trim(),tok=++st.tok;
    setHint('Проверяем ник…','');
    const r=await serverCall('check',{nick:v});
    if(tok!==st.tok)return;
    if(r.status===200&&r.ok){st.okNick=v;setHint('✓ Ник свободен','pos');}
    else if(r.status===0){st.okNick=null;setHint('Нет связи с сервером. Попробуйте ещё раз.','neg');}
    else{st.okNick=null;setHint(r.message||'Ник не подходит.','neg');}
    refresh(true);
  }
  function refresh(fromServer){
    const v=nick.value.trim(),c=checkNick(nick.value);
    if(!fromServer){
      st.tok++;st.okNick=null;clearTimeout(timer);
      if(!v)setHint('','');
      else if(!c.ok)setHint(c.msg,'neg');
      else if(serverOn()){setHint('Проверяем ник…','');timer=setTimeout(serverCheck,800);}
      else setHint('✓ Формат подходит','pos');
    }
    g.querySelectorAll('.gbtn').forEach(b=>b.classList.toggle('sel',b.dataset.g===st.gender));
    let dobOk=true;
    if(dob.value){const d=new Date(dob.value);dobOk=!isNaN(d)&&d<=new Date()&&d.getFullYear()>=1900;}
    dobH.textContent=dobOk?'':'Проверьте дату.';dobH.className='fhint '+(dobOk?'':'neg');
    const nickOk=c.ok&&(!serverOn()||st.okNick===v);
    go_.disabled=st.busy||!(nickOk&&st.gender&&dobOk);
  }
  async function submit(){
    const v=nick.value.trim();if(go_.disabled)return;
    const profile={name:v,gender:st.gender,birth:dob.value||null};
    if(!serverOn())return newGame('seeker',profile);
    st.busy=true;go_.disabled=true;setHint('Создаём героя…','');
    const r=await serverCall('register',{nick:v,gender:st.gender,birth:dob.value||null});
    st.busy=false;
    if(r.status===200&&r.ok&&r.player)return newGame('seeker',{name:r.player.nick,gender:r.player.gender,birth:r.player.birth});
    st.okNick=null;setHint(r.status===0?'Нет связи с сервером. Попробуйте ещё раз.':(r.message||'Не удалось создать героя.'),'neg');refresh(true);
  }
  nick.addEventListener('input',()=>refresh(false));dob.addEventListener('input',()=>refresh(true));refresh(false);
}

function go(id,msg=[]){
  hideTip();
  inFight=false;clearTimer();
  if(S.equip&&S.equip.armor){S.equip.chest=S.equip.armor;delete S.equip.armor;}   // старые сохранения
  const prevZoom=lastZoomKey,prevInfo=lastZoomInfo;lastZoomKey=null;lastZoomInfo=null;
  S.pets=S.pets||[];trapper(S);
  if(giveBelt(S))save();   // пояс всем, кто уже получил снаряжение аколита
  S.wins=S.wins||0;S.losses=S.losses||0;
  if(S.base.luck==null)S.base.luck=1;
  if((S.base.stamina||0)<50)S.base.stamina=50;   // запас выносливости увеличен до 50 (старые сохранения)
  const sc=SCENES[id];S.scene=sc.resume||(sc.combat&&sc.combat.resume)||id;
  let log=[...msg];
  if(sc.onEnter&&!(sc.grant&&sc.needs&&!sc.needs(S,{now:Date.now()}))){const f0=sc.grant?JSON.stringify([S.flags,S.daily]):'';const r=sc.onEnter(S,{now:Date.now()});if(Array.isArray(r))log.push(...r);if(sc.grant&&JSON.stringify([S.flags,S.daily])!==f0)queueOp({op:'scene',id});}
  save();hud();
  if(sc.combat) return startCombat(sc);
  if(sc.shop) return shopScreen(sc);
  if(sc.sell) return sellScreen(sc);
  if(sc.craft) return craftScreen(sc);
  if(sc.synergy) return synergyScreen(sc);
  if(sc.petsell) return petSellScreen(sc);
  if(sc.cook) return cookScreen(sc);
  if(sc.revive) return reviveScreen(sc);
  const txt=typeof sc.text==='function'?sc.text(S):sc.text;
  $screen.innerHTML='';
  const page=mk('page'),act=mk('actions');
  if(sc.image)page.append(mk('scene-img',`<img src="${pic(sc.image)}" alt="${sc.title||''}"${sc.zoom?' data-zoom':''}${sc.imagePos?` style="object-position:${sc.imagePos}"`:''}>`));
  else page.append(mk('scene-img ph'));   // нет картинки: пустое место той же гибкой высоты, чтобы кнопки не прыгали между экранами
  const body=mk('body',`<div class="text">${txt.split('\n\n').map(p=>`<p>${p}</p>`).join('')}</div>`);
  if(log.length)body.append(mk('log',log.map(l=>`<div>${l}</div>`).join('')));
  page.append(body);
  let rowEl=null;   // кнопки с row:true идут в один ряд (например, стороны света)
  const lowHp=S.hp<maxHp(S)*0.3;   // здоровья меньше 30% — предупреждаем перед боем
  const isFightTo=to=>{const t=SCENES[to];return !!t&&(!!t.combat||/_fight$/.test(to));};
  if(lowHp&&(sc.choices||[]).some(ch=>(!ch.if||ch.if(S))&&isFightTo(ch.to)))body.append(mk('log',`<div>⚠ Здоровья мало (${S.hp}/${maxHp(S)}). Бой сейчас может кончиться плохо: лучше отдохнуть или выпить зелье.</div>`));
  (sc.choices||[]).forEach(ch=>{
    if(ch.if&&!ch.if(S))return;
    const poor=ch.cost?.gold&&coins(S)<ch.cost.gold;
    const b=btn(ch.t,()=>{
      if(ch.cost?.gold)spend(S,ch.cost.gold);
      const out=ch.give?gain(S,ch.give):[];
      if(ch.msg)out.unshift(ch.msg);
      go(ch.to,out);
    },'',poor?'Не хватает монет':ch.soon?'Скоро':ch.sub||(lowHp&&isFightTo(ch.to)?'Мало здоровья':''));
    if(poor||ch.soon)b.disabled=true;
    if(ch.dim)b.classList.add('dimmed');
    if(ch.hint){b.title=ch.hint;b.setAttribute('aria-label',ch.hint);}
    if(ch.row){if(!rowEl){rowEl=mk('dirs');act.append(rowEl);}rowEl.append(b);}else{rowEl=null;act.append(b);}
  });
  page.append(act);$screen.append(page);
  const zi=page.querySelector('img[data-zoom]');
  if(zi){const key=sc.image+JSON.stringify(sc.zoom);setupZoom(zi,sc,prevZoom===key);lastZoomKey=key;lastZoomInfo={image:sc.image,zoom:sc.zoom};}
  else if(prevInfo&&sc.image&&sc.image===prevInfo.image){const pi=page.querySelector('.scene-img img');if(pi)setupUnzoom(pi,sc,prevInfo);}
  $screen.scrollTop=0;
}

const STAT_LABEL={dmg:'Урон',def:'Защита',crit:'Шанс крита',dodge:'Уклонение',hp:'Здоровье',stamina:'Выносливость',luck:'Удача',str:'Сила',agi:'Ловкость',int:'Разум',pet:'Сила питомца',taken:'Получаемый урон',dmgPct:'Урон',hpPct:'Здоровье',share:'Прикрытие питомца'};
const PCT_STATS=['crit','dodge','pet','taken','dmgPct','hpPct','share'];
const bonusText=b=>Object.entries(b).filter(([,v])=>v).map(([k,v])=>`${v>0?'+':''}${v}${PCT_STATS.includes(k)?'%':''} ${STAT_LABEL[k]}`).join(', ');

// ---- Подсказка с характеристиками: наведение мышью или долгое нажатие на телефоне ----
const fmtNum=n=>String(Math.round(n*10)/10);
function setTip(it){   // комплект: сколько вещей надето и какие бонусы за 2, 4, 7
  const st=SETS[it.set],n=setCount(S,it.set);
  return `<div class="ts">${st.name} (${n}/7)</div>`+Object.keys(st.bonus).map(th=>`<div><span class="${n>=+th?'pos':'neg'}">${th} ${plural(+th,'вещь','вещи','вещей')}</span><b class="${n>=+th?'pos':'neg'}">${bonusText(st.bonus[th])}</b></div>`).join('');
}
function tipItem(it,slotLabel){
  const lines=Object.entries(it.bonus||{}).filter(([,v])=>v).map(([k,v])=>`<div><span>${STAT_LABEL[k]}</span><b class="${v>0?'pos':'neg'}">${v>0?'+':''}${v}${PCT_STATS.includes(k)?'%':''}</b></div>`).join('');
  const cap=it.capture?it.capture.base.map(r=>`<div><span>Шанс поимки (${r.from}–${r.to} ур.)</span><b>${r.chance}%</b></div>`).join(''):'';
  const ck=it.cook?`<div class="ts">Рецепт блюда</div>`+Object.entries(it.cook.ingredients).map(([k,n])=>`<div><span>${ITEMS[k].name}</span><b>×${n}</b></div>`).join('')+`<div><span>Шанс</span><b>${it.cook.chance}%</b></div><div><span>Готовит</span><b>${ITEMS[it.cook.result].name}</b></div>`:'';
  const fd=it.food?`<div><span>Урон, защита, крит, уклонение</span><b class="pos">+${it.food.pct}%</b></div><div><span>Действует</span><b>${it.food.min} мин</b></div>`:'';
  const rec=it.recipe?`<div class="ts">Рецепт · ${it.recipe.tier}</div>`+Object.entries(it.recipe.ingredients).map(([k,n])=>`<div><span>${ITEMS[k].name}</span><b>×${n}</b></div>`).join('')+`<div><span>Шанс создания</span><b>${it.recipe.chance}%</b></div><div><span>Создаёт</span><b>${ITEMS[it.recipe.result].name}</b></div>`:'';
  const big=it.img?`<img class="tipimg" src="${pic(it.img)}" alt="">`:'';   // в подсказке картинка крупнее, чем в списках
  return `${big}<div class="tn">${it.img?'':iic(it)+' '}${it.name}${it.junk?' <span class="tag">хлам</span>':''}${it.material?' <span class="tag">материал</span>':''}</div>
    ${slotLabel?`<div class="ts">${slotLabel}</div>`:''}${it.cook?ck:it.food?fd:it.recipe?rec:(lines||(it.use?`<div><span>Лечит</span><b class="pos">${it.use.healPct}% здоровья</b></div>`:cap||it.material||it.junk||it.currency?'':'<div class="ts">Без бонусов</div>'))}${cap}
    ${it.set&&SETS[it.set]?setTip(it):''}${it.path?`<div><span>Путь</span><b>${PATHS[it.path].short}</b></div>${it.path!==S.path?'<div class="ts"><span class="neg">Не действует: вещь другого пути</span></div>':''}`:''}${it.minLvl?`<div><span>Уровень</span><b>${it.minLvl}</b></div>`:''}${it.sell?`<div><span>Цена продажи</span><b>${it.sell} ${coinIcon()}</b></div>`:''}${it.desc?`<div class="ts">${it.desc}</div>`:''}`;
}
function tipPet(p){
  const m=ENEMIES[p.species],st=petStats(p,S.lvl,petBonusPct(S));
  return `<div class="tn">${m.icon} ${petName(p)}</div>
    <div class="ts">${p.dead?'Погиб':'Ранг '+p.rank+' · '+Math.round(RANK_F[p.rank]*100)+'% от монстра вашего уровня'}</div>
    <div><span>Здоровье</span><b>${st.hp}</b></div><div><span>Урон</span><b>${st.dmg}</b></div><div><span>Защита</span><b>${st.def}</b></div>
    <div><span>Шанс крита</span><b>${fmtNum(st.crit)}%</b></div><div><span>Уклонение</span><b>${fmtNum(st.dodge)}%</b></div>`;
}
let tipEl=null,tipTimer=null;
function hideTip(){clearTimeout(tipTimer);if(tipEl){tipEl.remove();tipEl=null;}}
function showTip(target,html){
  hideTip();
  tipEl=document.createElement('div');tipEl.id='tip';tipEl.innerHTML=html;document.body.appendChild(tipEl);
  const r=target.getBoundingClientRect(),w=tipEl.offsetWidth,h=tipEl.offsetHeight;
  let x=r.left+r.width/2-w/2;x=Math.max(8,Math.min(innerWidth-w-8,x));
  let y=r.top-h-8;if(y<8)y=r.bottom+8;
  tipEl.style.left=x+'px';tipEl.style.top=y+'px';
}
function attachTip(elm,html){
  let press=null;
  elm.addEventListener('mouseenter',()=>showTip(elm,html));
  elm.addEventListener('mouseleave',hideTip);
  elm.addEventListener('touchstart',()=>{press=setTimeout(()=>{elm._lp=true;showTip(elm,html);tipTimer=setTimeout(hideTip,3500);},450);},{passive:true});
  ['touchend','touchmove','touchcancel'].forEach(ev=>elm.addEventListener(ev,()=>clearTimeout(press),{passive:true}));
  elm.addEventListener('contextmenu',e=>e.preventDefault());
  elm.addEventListener('click',e=>{if(elm._lp){e.stopImmediatePropagation();e.preventDefault();elm._lp=false;}else hideTip();},true);
  return elm;
}
document.addEventListener('touchstart',e=>{if(tipEl&&!e.target.closest('button,.card'))hideTip();},{passive:true});

// Админ: +/- напротив предмета (только для админа / локальной разработки)
function adjItem(id,d,back){
  doOp({op:'admin_item',id,d});inventoryScreen(back);
}
function withPM(elm,id,back){
  if(!isAdmin())return elm;
  const row=mk('irow'),pm=(txt,d)=>{const b=document.createElement('button');b.className='pm';b.type='button';b.textContent=txt;b.setAttribute('aria-label',d>0?'Добавить':'Убавить');b.onclick=()=>adjItem(id,d,back);return b;};
  row.append(elm,pm('−',-1),pm('+',1));return row;
}
function catalogScreen(back){
  $screen.innerHTML='';$screen.append(el('<h2>Админ: добавить предмет</h2>'));
  Object.entries(ITEMS).forEach(([id,it])=>$screen.append(attachTip(btn(`${itemName(it)}`,()=>{doOp({op:'admin_item',id,d:1});catalogScreen(back);},'',`есть: ${S.inv[id]||0} · нажмите, чтобы добавить 1`),tipItem(it,it.slot?SLOTS[slotsFor(it.slot)[0]]:''))));
  $screen.append(el('<h2>Админ: добавить питомца</h2>'));
  Object.entries(ENEMIES).forEach(([sp,m])=>RANKS.forEach(rk=>$screen.append(btn(`${m.icon} ${m.name} [${rk}]`,()=>{doOp({op:'admin_pet',species:sp,rank:rk});catalogScreen(back);},'dimmed',`сейчас питомцев: ${S.pets.length}`))));
  $screen.append(btn('← Назад',()=>inventoryScreen(back)));
}
function inventoryScreen(back,note=''){
  $screen.innerHTML='';
  $screen.append(el('<h2>Инвентарь</h2>'));
  if(note)$screen.append(mk('log',note));
  $screen.append(el('<h2>Экипировка</h2>'));
  const worn=Object.entries(SLOTS).filter(([k])=>S.equip[k]);
  if(!worn.length)$screen.append(el('<p class="dim">Ничего не надето.</p>'));
  worn.forEach(([k,label])=>{
    const it=ITEMS[S.equip[k]];
    $screen.append(attachTip(btn(`${iic(it)} ${it.name}`,()=>{doOp({op:'equip',key:k,id:null});inventoryScreen(back);},'',
      `${label} · ${bonusText(it.bonus)} · нажмите, чтобы снять`),tipItem(it,label)));
  });

  $screen.append(el('<h2>Сумка</h2>'));
  const qty=id=>ITEMS[id].slot?S.inv[id]-equippedCount(S,id):S.inv[id];
  const ids=Object.keys(S.inv).filter(id=>ITEMS[id]&&!ITEMS[id].recipe&&!ITEMS[id].cook&&qty(id)>0);
  if(!ids.length)$screen.append(el('<p class="dim">Пусто.</p>'));
  ids.forEach(id=>{
    const it=ITEMS[id];
    if(it.grind){
      $screen.append(withPM(attachTip(btn(`${iic(it)} ${it.name} ×${S.inv[id]}`,()=>grindScreen(id,back),'','нажмите, чтобы перемолоть в муку'),tipItem(it,'')),id,back));
    } else if(it.food){
      const left=buffLeftMin();
      $screen.append(withPM(attachTip(btn(`${iic(it)} ${it.name} ×${S.inv[id]}`,()=>{
        const r=doOp({op:'eat',id});inventoryScreen(back,r.ok?`Вы съедаете ${low(it.name)}: +${r.res.pct}% к урону, защите, криту и уклонению на ${r.res.min} мин.`:r.msg);
      },'',left?`Съесть · сейчас действует ещё ${left} мин, отсчёт начнётся заново`:'Съесть'),tipItem(it,'')),id,back));
    } else if(it.use){
      $screen.append(withPM(attachTip(btn(`${iic(it)} ${it.name} ×${S.inv[id]}`,()=>{
        doOp({op:'use',id});inventoryScreen(back);
      },'',`Восстановить ${healAmount(S,id)} ❤️`),`<div class="tn">${iic(it)} ${it.name}</div><div><span>Лечит</span><b class="pos">+${healAmount(S,id)} (${it.use.healPct}%)</b></div>`),id,back));
    } else if(!it.slot){
      $screen.append(withPM(attachTip(el(`<div class="card">${itemName(it)} ×${S.inv[id]}<div class="dim" style="font-size:14px">${it.desc||''}</div></div>`),tipItem(it,'')),id,back));
    } else {
      $screen.append(withPM(attachTip(btn(`${iic(it)} ${it.name}`,()=>{
        const r=doOp({op:'equip',key:keyFor(S,id),id});inventoryScreen(back,r.ok?'':r.msg);
      },'',`${SLOTS[slotsFor(it.slot)[0]]} · ${bonusText(it.bonus)} · ${it.minLvl>S.lvl?`нужен ${it.minLvl}-й уровень`:'нажмите, чтобы надеть'}`),tipItem(it,SLOTS[slotsFor(it.slot)[0]])),id,back));
    }
  });
  $screen.append(el('<h2>Рецепты</h2>'));
  const rids=Object.keys(S.inv).filter(id=>ITEMS[id]?.recipe&&S.inv[id]>0),cids=Object.keys(S.inv).filter(id=>ITEMS[id]?.cook&&S.inv[id]>0);
  if(!rids.length&&!cids.length)$screen.append(el('<p class="dim">Рецептов нет.</p>'));
  cids.forEach(id=>{   // рецепты блюд: готовятся в харчевне «Последний ужин»
    const it=ITEMS[id],r=it.cook;
    $screen.append(withPM(attachTip(el(`<div class="card">${itemName(it)}<div class="dim" style="font-size:14px">${Object.entries(r.ingredients).map(([k,n])=>`${ITEMS[k].name} ${S.inv[k]||0}/${n}`).join(', ')} · готовится в харчевне «Последний ужин»</div></div>`),tipItem(it,'')),id,back));
  });
  rids.forEach(id=>{
    const it=ITEMS[id],r=it.recipe;
    $screen.append(withPM(attachTip(btn(`${itemName(it)}`,()=>recipeScreen(id,back),'',
      Object.entries(r.ingredients).map(([k,n])=>`${ITEMS[k].name} ${S.inv[k]||0}/${n}`).join(', ')),tipItem(it,'')),id,back));
  });
  $screen.append(el('<h2>Питомцы</h2>'));
  if(!S.pets.length)$screen.append(el('<p class="dim">Пойманных питомцев нет.</p>'));
  S.pets.forEach(p=>{
    const eq=S.pet===p.id,m=ENEMIES[p.species];
    if(p.dead)$screen.append(attachTip(el(`<div class="card">${m.icon} ${petName(p)} <span class="tag">погиб</span>${eq?' <span class="tag">в клети</span>':''}</div>`),tipPet(p)));
    else if(eq)$screen.append(attachTip(btn(`${m.icon} ${petName(p)} <span class="tag">в клети</span>`,()=>{doOp({op:'setpet',id:null});inventoryScreen(back);},'','нажмите, чтобы выпустить из клети'),tipPet(p)));
    else $screen.append(attachTip(btn(`${m.icon} ${petName(p)}`,()=>{doOp({op:'setpet',id:p.id});inventoryScreen(back);},'','нажмите, чтобы посадить в клеть'),tipPet(p)));
  });
  if(isAdmin())$screen.append(btn('＋ Админ: добавить предмет',()=>catalogScreen(back),'dimmed'));
  $screen.append(btn('← Назад',()=>go(back)));
}

// Создание вещи по рецепту. Простые рецепты: шанс 100%, рецепт исчезает. У редких и выше при создании
// (удачном или нет) пропадают и рецепт, и ингредиенты. Само создание будет в «Лавке ремесленника» (пока ожидание);
// в демо кнопка доступна только админу для проверки.
const canCraft=craftable;
const craftNote=res=>res.win?`Создано: ${iic(ITEMS[res.result])} ${ITEMS[res.result].name}`:'Не вышло: остался лишь кукиш с маслом. Рецепт и материалы пропали.';
async function craftRecipe(id){
  if(serverOn()){const r=await serverCraft(id);hud();return r.ok?craftNote(r.res):r.msg;}
  const r=applyOp(S,{op:'craft',id,seed:(Math.random()*4294967296)>>>0});
  if(!r.ok)return r.msg;
  save();hud();return craftNote(r.res);
}
// Лавка ремесленника: список рецептов из инвентаря (без дублей), материалы «нужно / есть», кнопка создания
function craftScreen(sc,note=''){
  hud();$screen.innerHTML='';
  const page=mk('page'),body=mk('body','<h2>Создать</h2>');
  if(sc.image)page.append(mk('scene-img',`<img src="${pic(sc.image)}" alt=""${sc.zoom?' data-zoom':''}${sc.imagePos?` style="object-position:${sc.imagePos}"`:''}>`));
  if(note)body.append(mk('log',note));
  page.append(body);
  const act=mk('actions'),ids=Object.keys(S.inv).filter(id=>ITEMS[id]?.recipe&&S.inv[id]>0&&(!ITEMS[id].path||ITEMS[id].path===S.path));
  if(!ids.length)act.append(mk('dim','Рецептов нет: ремесленнице нечего мастерить.'));
  ids.forEach(id=>{
    const it=ITEMS[id],r=it.recipe,res=ITEMS[r.result],can=canCraft(S,r);
    const mats=Object.entries(r.ingredients).map(([k,n])=>{const have=S.inv[k]||0;return `${ITEMS[k].name}: <span class="${have>=n?'pos':'neg'}">${have}/${n}</span>`;}).join(' · ');
    const b=btn(itemName(it),()=>craftRecipe(id).then(n=>craftScreen(sc,n)),can?'primary':'dimmed',`Материалы: ${mats}`);
    act.append(attachTip(b,tipItem(res,res.slot?SLOTS[slotsFor(res.slot)[0]]:'')));
  });
  act.append(btn('← Назад',()=>go(sc.back)));
  page.append(act);$screen.append(page);$screen.scrollTop=0;
  const zi=page.querySelector('img[data-zoom]');if(zi)setupZoom(zi,sc,true);
}
// конец craftScreen
function recipeScreen(id,back){
  const it=ITEMS[id],r=it.recipe,res=ITEMS[r.result],can=canCraft(S,r);
  $screen.innerHTML='';
  $screen.append(el('<h2>Рецепт</h2>'));
  $screen.append(el(`<div class="card">${itemName(it)}<div class="dim" style="font-size:14px">${it.desc||''}</div></div>`));
  $screen.append(el('<h2>Материалы</h2>'));
  Object.entries(r.ingredients).forEach(([k,n])=>{const have=S.inv[k]||0;
    $screen.append(el(`<div class="card">${iic(ITEMS[k])} ${ITEMS[k].name} <b class="${have>=n?'pos':'neg'}" style="float:right;font-weight:normal">${have}/${n}</b></div>`));});
  $screen.append(el(`<div class="card dim">Шанс создания: ${r.chance}%</div>`));
  $screen.append(attachTip(el(`<div class="card">Создаёт: ${itemName(res)}<div class="dim" style="font-size:13px">${bonusText(res.bonus)}</div></div>`),tipItem(res,SLOTS[slotsFor(res.slot)[0]])));
  $screen.append(el('<div class="card dim">Рецепты создаются в лавке ремесленника (Кривой переулок).</div>'));
  $screen.append(btn('← Назад',()=>inventoryScreen(back)));
}
// Журнал заданий: состояние вычисляется из флагов (отдельного хранения нет)
// Задания: состояние вычисляется из флагов. t — полный текст (журнал), short — коротко (верхняя панель)
// Состояние ежедневного задания для экрана: «бой начат, но не идёт» значит провал (закрыли игру или сбежали)
const escortView=s=>{const st=dailyState(s);return st==='fight'&&!inFight?'failed':st;};
// Основные задания в логическом порядке (от первого к последнему). В журнале они показываются в обратном: новые сверху.
function questTasks(s){
  const f=s.flags,hasRecipe=!!f.recipe||(s.inv.recipe_cloak_poor||0)>0||(s.inv.cloak_rat_poor||0)>0;
  return [
    {k:'contract',t:'Поговорить с мастером-наставником в Гильдии искателей.',short:'Поговорить с наставником',d:!!f.contract},
    {k:'cage',t:'Пойти в Дом ловцов и укротителей в Кривом переулке, поговорить с инструктором и взять клеть.',short:'Дом ловцов: взять клеть',d:!!f.cage_gift},
    {k:'lvl2',t:'Достичь 2-го уровня.',short:'Достичь 2-го уровня',d:s.lvl>=2},
    {k:'gear',t:'Вернуться к мастеру-наставнику.',short:'Вернуться к наставнику',d:!!f.gear},
    {k:'cloak',t:'Создать «Некачественный крысиный плащ» в лавке ремесленника.',short:'Создать крысиный плащ',d:!!f.cloak_made||(s.inv.cloak_rat_poor||0)>0,show:hasRecipe,par:true},
    {k:'lvl3',t:'Достичь 3-го уровня.',short:'Достичь 3-го уровня',d:s.lvl>=3,show:!!f.gear},
    {k:'m3',t:'Вернуться к мастеру-наставнику (3-й уровень).',short:'Вернуться к наставнику',d:!!f.m3,show:s.lvl>=3&&!!f.gear},
    {k:'knight',t:'Подойти к Рыцарю внутреннего двора в Гильдии искателей.',short:'Подойти к Рыцарю',d:!!f.knight_met,show:!!f.m3},
    {k:'lvl4',t:'Достичь 4-го уровня.',short:'Достичь 4-го уровня',d:s.lvl>=4,show:!!f.knight_met},
    {k:'path_q',t:'Поговорить с Рыцарем о дальнейшем пути (4-й уровень).',short:'К Рыцарю: путь',d:!!f.path_quest,show:s.lvl>=4&&!!f.knight_met},
    {k:'path_ment',t:'Послушать трёх бывалых: старого солдата у повозки в Кривом переулке, наёмника в харчевне «Последний ужин» и инструктора ловцов.',short:'Послушать трёх бывалых',d:heardAll(s),show:!!f.path_quest,par:true},
    {k:'path_pick',t:'Выбрать путь у Рыцаря: Щит, Меч или Укротитель Агинды.',short:'Выбрать путь',d:!!s.path,show:!!f.path_quest},
    {k:'king5',t:'Победить крысиного короля на 5-м уровне или выше и рассказать об этом Рыцарю: он наградит на снаряжение.',short:'Рассказать Рыцарю о короле',d:!!f.king5_paid,show:!!s.path&&s.lvl>=5},
  ].filter(x=>x.show!==false);
}
// Ежедневные задания (отдельная вкладка журнала). st: avail — можно взять, taken — взято, won — выполнено, осталось сдать, failed, done
function dailyTasks(s){
  const out=[],f=s.flags;
  if(f.m3){
    const st=escortView(s),map={
      none:{t:'Ежедневное: сопроводить разведывательный отряд за стену. Задание выдаёт Рыцарь внутреннего двора в Гильдии искателей (раз в день).',short:'Взять у Рыцаря: сопровождение',mark:'○'},
      taken:{t:'Сопроводить разведывательный отряд за стену. Отряд ждёт в Кривом переулке. Если проиграть или сбежать, задание провалено.',short:'Сопроводить отряд',mark:'●',active:true},
      fight:{t:'Сопроводить разведывательный отряд: идёт бой.',short:'Сопроводить отряд',mark:'●',active:true},
      won:{t:'Отнести молочный зуб тролля-болотника Рыцарю внутреннего двора в Гильдии искателей.',short:'Сдать зуб Рыцарю',mark:'●',active:true},
      failed:{t:'Сопроводить разведывательный отряд: задание провалено. Новое можно взять завтра у Рыцаря.',short:'Задание провалено',mark:'✗',done:true},
      done:{t:'Сопроводить разведывательный отряд: выполнено. Новое можно взять завтра.',short:'Выполнено',mark:'✓',done:true},
    };
    out.push({...map[st],st,k:'escort'});
  }
  return out;
}
// Активные задания: первое невыполненное из цепочки + все невыполненные параллельные (par) + активные ежедневные. В панели сменяются каждые 5 секунд.
function activeTasks(s){
  const all=questTasks(s),chain=all.filter(x=>!x.par).find(x=>!x.d);
  return [...all.filter(x=>!x.d&&(x.par||x===chain)),...dailyTasks(s).filter(x=>x.active)];
}
let qIdx=0;
function refreshQTask(){
  const qt=document.querySelector('#hud .qtask');if(!qt||!S)return;
  const a=activeTasks(S);if(!a.length)return;
  const at=a[qIdx%a.length];qt.innerHTML='<i>●</i> '+at.short;qt.title='Активное задание: '+at.t;
}
setInterval(()=>{qIdx++;refreshQTask();},5000);
let journalTab='main';
// Строка задания; админу справа кнопка ↻ — сбросить задание, чтобы пройти его заново
function taskRow(x,cls,mark,back){
  const card=el(`<div class="card task ${cls}">${mark} ${x.t}</div>`);
  if(!isAdmin()||!x.k)return card;
  const row=mk('irow'),b=document.createElement('button');b.className='pm';b.type='button';b.textContent='↻';b.title='Админ: сбросить задание';b.setAttribute('aria-label','Сбросить задание');
  b.onclick=()=>{doOp({op:'admin_task',task:x.k});journalScreen(back);};
  row.append(card,b);return row;
}
function journalScreen(back){
  $screen.innerHTML='';$screen.append(el('<h2>Журнал заданий</h2>'));
  const row=mk('row');
  [['main','Основные'],['daily','Ежедневные']].forEach(([k,label])=>row.append(btn(label,()=>{journalTab=k;journalScreen(back);},journalTab===k?'sel':'')));
  $screen.append(row);
  const act=activeTasks(S);
  if(journalTab==='daily'){
    const d=dailyTasks(S);
    if(!d.length)$screen.append(el('<p class="dim">Ежедневных заданий пока нет. Они появятся после наставления мастера на 3-м уровне.</p>'));
    d.forEach(x=>$screen.append(taskRow(x,x.done?'done':x.active?'cur':'next',x.mark,back)));
    const done=S.escortDone||0,nx=SLAYER_STAGES.find(st=>!S.flags[st.flag]);
    if(S.flags.m3)$screen.append(el(`<p class="dim" style="font-size:13px">Сдано заданий сопровождения: ${done}.${nx?` До следующей ступени ожерелья — ещё ${Math.max(0,nx.need-done)}.`:''}</p>`));
    $screen.append(el('<p class="dim" style="font-size:13px">Обновляются каждый день в полночь по Москве.</p>'));
  }else{
    const tasks=questTasks(S).slice().reverse();   // новые задания сверху
    tasks.forEach(x=>{const on=act.some(a=>a.t===x.t);$screen.append(taskRow(x,x.d?'done':on?'cur':'next',x.d?'✓':on?'●':'○',back));});
    if(!act.length)$screen.append(el('<p class="dim">Новых заданий пока нет.</p>'));
  }
  $screen.append(btn('← Назад',()=>characterScreen(back)));
}

function portraitSVG(g){
  const f=g==='f',m=g==='m';
  const cloak=f?'M52 68 L28 128 L18 188 L102 188 L92 128 L68 68Z':m?'M48 66 L26 118 L22 188 L98 188 L94 118 L72 66Z':'M50 68 L30 120 L22 188 L98 188 L90 120 L70 68Z';
  return `<svg viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linejoin="round" stroke-linecap="round">
  <ellipse cx="60" cy="190" rx="38" ry="5" fill="#000" opacity=".5"/>
  <rect x="78" y="74" width="22" height="34" rx="6" fill="#241d14" stroke="#7a6128" stroke-width="1.5"/>
  <path d="${cloak}" fill="#17141d" stroke="#d4a73a" stroke-width="1.6"/>
  <path d="M60 22C46 22 38 34 40 48C41 58 46 64 50 70L70 70C74 64 79 58 80 48C82 34 74 22 60 22Z" fill="#1d1a26" stroke="#d4a73a" stroke-width="1.6"/>
  <ellipse cx="60" cy="47" rx="10" ry="12" fill="#06050a"/>
  <circle cx="56" cy="46" r="1.4" fill="#e3b84a"/><circle cx="64" cy="46" r="1.4" fill="#e3b84a"/>
  ${f?'<path d="M44 52C36 66 38 86 44 104" stroke="#8a5a2b" stroke-width="5"/><path d="M45 104C47 110 41 112 40 108" stroke="#8a5a2b" stroke-width="3"/>':''}
  ${m?'<path d="M52 56C56 62 64 62 68 56" stroke="#3a3548" stroke-width="2"/>':''}
  <path d="M60 70 L60 186" stroke="#2c2838" stroke-width="1.2"/>
  <path d="M26 112 C26 104 44 104 48 112 L46 134 C42 142 32 142 28 134Z" fill="#241d14" stroke="#d4a73a" stroke-width="1.6"/>
  <path d="M84 120 L100 86" stroke="#cfd3dc" stroke-width="3"/><path d="M80 112 L90 118" stroke="#d4a73a" stroke-width="3"/>
</svg>`;
}

// Положение слотов на «листе персонажа» (центр слота, % ширины/высоты листа)
const SLOT_POS={
  cloak:{side:'r',y:13}, helmet:{side:'l',y:13}, chest:{side:'l',y:32}, offhand:{side:'l',y:51}, belt:{side:'l',y:71}, pants:{side:'l',y:90},
  gloves:{side:'r',y:32}, weapon:{side:'r',y:51}, boots:{side:'r',y:90},
};
// Голые статы — белым, прибавка от экипировки — зелёным в скобках
const eqSum=(s,stat)=>equipped(s).reduce((a,i)=>a+(i.bonus?.[stat]||0),0)+setBonus(s,stat);
const plusTxt=(n,suf='')=>n?` <i class="plus">(${n>0?'+':''}${n}${suf})</i>`:'';
const statRow=(k,v)=>`<div><span>${k}</span><b>${v}</b></div>`;

function slotButton(key,back,st=S){   // st — чей это герой (по умолчанию наш); у чужого слоты только для просмотра
  const id=st.equip[key],it=id&&ITEMS[id];
  const b=document.createElement('button');b.className='slot'+(it?' on':'');
  b.innerHTML=it?(it.img?`<img class="iic simg" src="${pic(it.img)}" alt="">`:`<span class="ic">${it.icon}</span>`):`<span class="sl">${key==='cage'?'Клеть':SLOTS[key]}</span>`;
  b.setAttribute('aria-label',SLOTS[key]+(it?': '+it.name:''));
  if(st===S)b.onclick=()=>slotScreen(key,back);
  if(!it)return b;
  let html=tipItem(it,SLOTS[key]);
  if(it.slots&&st===S){   // пояс: что лежит в его слотах (зелья встают сами из сумки)
    const aux=auxList(S);
    html+=`<div class="ts">Вспомогательные слоты: ${it.slots}</div>`+Array.from({length:it.slots},(_,i)=>{const id=aux[i];return `<div><span>Слот ${i+1}</span><b>${id?iic(ITEMS[id])+' '+ITEMS[id].name+' (в сумке ×'+S.inv[id]+')':'пусто'}</b></div>`;}).join('');
  }
  return attachTip(b,html);
}
function petSlotButton(back){
  const p=curPet(S),b=document.createElement('button');b.className='slot'+(p?(p.dead?' dead':' on'):'');
  b.innerHTML=p?`<span class="ic">${ENEMIES[p.species].icon}</span><span class="rk">${p.dead?'погиб':p.rank}</span>`:'<span class="sl">Питомец</span>';
  b.setAttribute('aria-label','Питомец'+(p?': '+petName(p):''));b.onclick=()=>petSlotScreen(back);
  return p?attachTip(b,tipPet(p)):b;
}
function petSlotScreen(back,note=''){
  $screen.innerHTML='';
  $screen.append(el('<h2>Питомец</h2>'));
  if(note)$screen.append(el(`<div class="log">${note}</div>`));
  const cur=curPet(S);
  if(cur)$screen.append(attachTip(btn(`${ENEMIES[cur.species].icon} ${petName(cur)}${cur.dead?' · погиб':''}`,()=>{const nm=petName(cur);doOp({op:'setpet',id:null});petSlotScreen(back,`${nm} убран из слота и остался в сумке. В бой он не пойдёт, пока вы не посадите его обратно (ниже или в инвентаре).`);},'','нажмите, чтобы убрать из слота (питомец останется в сумке)'),tipPet(cur)));
  const list=S.pets.filter(p=>!p.dead&&p.id!==S.pet);
  if(!list.length&&!cur)$screen.append(el('<p class="dim">Пойманных питомцев нет. Монстров ловят клетью-ловушкой в бою.</p>'));
  list.forEach(p=>$screen.append(attachTip(btn(`${ENEMIES[p.species].icon} ${petName(p)}`,()=>{doOp({op:'setpet',id:p.id});characterScreen(back);},'','нажмите, чтобы посадить в слот'),tipPet(p))));
  $screen.append(btn('← Назад',()=>characterScreen(back)));
}
// Титулы: список с условиями, выбор активного титула (он показывается в окне «Персонаж»)
// Прогресс к закрытому титулу (для подсказки)
const titleProgress=id=>id==='catcher'?` (${S.captures||0}/30)`:id==='ratslayer'?` (${RAT_KINDS.map(k=>Math.min(10,(S.kills||{})[k]||0)).join(' / ')} из 10, по порядку: детёныши, Матки, короли)`:'';
function titlesScreen(back){
  $screen.innerHTML='';$screen.append(el('<h2>Титулы</h2>'));
  $screen.append(el('<p class="dim" style="font-size:13px">Бонусы дают все полученные титулы. Выбранный показывается в профиле и чате.</p>'));
  const u=titlesUnlocked(S),cur=u.includes(S.title)?S.title:u[0];
  Object.entries(TITLES).forEach(([id,tt])=>{
    if(u.includes(id)){
      $screen.append(btn(tt.name+(id===cur?' <span class="tag">выбран</span>':''),()=>{doOp({op:'settitle',id});titlesScreen(back);},id===cur?'primary':'',`${titleBonusText(tt.bonus)} · нажмите, чтобы показывать`));
    }else $screen.append(el(`<div class="card dim">🔒 ${tt.name}<div style="font-size:13px">${tt.hint}${titleProgress(id)} · ${titleBonusText(tt.bonus)}</div></div>`));
  });
  $screen.append(btn('← Назад',()=>characterScreen(back)));
}
function characterScreen(back){
  regenHp(S);$screen.innerHTML='';
  const cl=CLASSES[S.cls],page=mk('page charpage'),ttl=titleOf(S);
  page.append(mk('body',`<div class="h2row"><h2>${S.name}</h2><button type="button" class="ttl" aria-label="Титулы">${ttl||'Титулы'} ▾</button></div>`));
  page.querySelector('.ttl').onclick=()=>titlesScreen(back);
  const heroImg=S.gender==='m'?'pictures/hero-male.png':S.gender==='f'?'pictures/hero-female.png':null;
  const paper=mk('paper',`<div class="fig${heroImg?' img':''}">${heroImg?`<img src="${pic(heroImg)}" alt="">`:portraitSVG(S.gender)}</div>`);
  Object.entries(SLOT_POS).forEach(([k,p])=>{
    const b=slotButton(k,back);b.style[p.side==='l'?'left':'right']='0';b.style.top=p.y+'%';paper.append(b);
  });
  const left=mk('pcol');left.append(paper,mk('cap',`${S.name} · ${cl.name}`));
  const hpBare=bareStat(S,'hp'),stBare=S.base.stamina||50;
  const dmgB=eqSum(S,'dmg')+eqSum(S,'str'),critB=eqSum(S,'crit')+eqSum(S,'agi'),dodB=eqSum(S,'dodge')+eqSum(S,'agi');
  const abil=['str','agi','int'].map(k=>bareStat(S,k)+plusTxt(eqSum(S,k))).join(' / ');
  const stats=mk('cstats',`
      ${statRow('Уровень',S.lvl+(pathOf(S)?' · '+pathOf(S).short:''))}
      ${statRow('Опыт',S.xp+'/'+xpNeed(S))}
      ${statRow('Здоровье',pathOf(S)?S.hp+'/'+maxHp(S):S.hp+'/'+hpBare+plusTxt(eqSum(S,'hp')+titleBonus(S,'hp')))}
      ${statRow('Выносл.',stam(S)+'/'+stBare+plusTxt(eqSum(S,'stamina')))}
      ${statRow('Урон',bareStat(S,'str')+plusTxt(dmgB))}
      ${statRow('Защита',bareStat(S,'def')+plusTxt(eqSum(S,'def')))}
      ${statRow('Крит',bareStat(S,'agi')+'%'+plusTxt(critB,'%'))}
      ${statRow('Уклонение',bareStat(S,'agi')+'%'+plusTxt(dodB,'%'))}
      ${statRow('Сил/Лов/Раз',abil)}
      ${statRow('Удача',bareStat(S,'luck')+plusTxt(eqSum(S,'luck')))}
      ${statRow('Победы/пораж.',(S.wins||0)+' / '+(S.losses||0))}
      ${buffLeftMin()?statRow('Еда',`<span class="pos">+${S.buff.pct}%</span> <i class="dim">(${buffLeftMin()} мин)</i>`):''}
      ${statRow('Ловец монстров',trapper(S).lvl+' <i class="dim">('+Math.floor(trapper(S).prog/trapNeed(trapper(S).lvl)*100)+'%)</i>')}`);
  page.append(mk('char-wrap'));page.lastChild.append(left,stats);
  // ювелирка
  const jr=mk('jrow');
  ['necklace','ring1','ring2','earring1','earring2','cage'].forEach(k=>jr.append(slotButton(k,back)));
  jr.append(petSlotButton(back));page.append(jr);
  const act=mk('actions');
  const r2=mk('acts3');r2.append(btn('🎒 Инвентарь',()=>inventoryScreen(back)),btn('📜 Журнал заданий',()=>journalScreen(back)));
  act.append(r2,btn('← Назад',()=>go(back),'primary'));
  page.append(act);$screen.append(page);
}
// Выбор предмета в слот: снять надетое или надеть подходящее из сумки
function slotScreen(key,back){
  $screen.innerHTML='';
  const type=slotType(key),cur=S.equip[key];
  $screen.append(el(`<h2>${SLOTS[key]}</h2>`));
  if(cur){const it=ITEMS[cur];
    $screen.append(attachTip(btn(`${iic(it)} ${it.name}`,()=>{doOp({op:'equip',key,id:null});characterScreen(back);},'',`${bonusText(it.bonus)} · нажмите, чтобы снять`),tipItem(it,SLOTS[key])));}
  const cand=Object.keys(S.inv).filter(id=>ITEMS[id]?.slot===type&&S.inv[id]-equippedCount(S,id)>0&&!(ITEMS[id].minLvl>S.lvl));
  if(!cand.length&&!cur)$screen.append(el('<p class="dim">Подходящих предметов в сумке нет.</p>'));
  cand.forEach(id=>{const it=ITEMS[id];
    $screen.append(attachTip(btn(`${iic(it)} ${it.name}`,()=>{doOp({op:'equip',key,id});characterScreen(back);},'',`${bonusText(it.bonus)} · нажмите, чтобы надеть`),tipItem(it,SLOTS[key])));});
  $screen.append(btn('← Назад',()=>characterScreen(back)));
}

// Дом ловцов: синергия — два питомца одного вида и ранга дают одного питомца рангом выше (бесплатно и сразу)
function synergyScreen(sc,note=''){
  hud();$screen.innerHTML='';
  const page=mk('page'),body=mk('body','<h2>Синергия</h2>');
  if(note)body.append(mk('log',note));
  page.append(body);
  const act=mk('actions'),groups={};
  S.pets.filter(p=>!p.dead&&p.rank!=='A').forEach(p=>(groups[p.species+'|'+p.rank]=groups[p.species+'|'+p.rank]||[]).push(p));
  const keys=Object.keys(groups).filter(k=>groups[k].length>=2);
  if(!keys.length)act.append(mk('dim','Нужны два живых питомца одного вида и ранга. Ранг A выше не растёт.'));
  keys.forEach(k=>{
    const [sp,rk]=k.split('|'),next=RANKS[RANKS.indexOf(rk)+1],list=groups[k];
    act.append(btn(`${ENEMIES[sp].icon} ${ENEMIES[sp].name}: 2 × [${rk}] → [${next}]`,()=>{
      const r=doOp({op:'synergy',species:sp,rank:rk});
      synergyScreen(sc,r.ok?`Два питомца в ужасном крике превратились в одного: ${ENEMIES[r.res.species].name}, ранг ${r.res.rank}.`:r.msg);
    },'',`Бесплатно · доступно пар: ${Math.floor(list.length/2)}`));
  });
  act.append(btn('← Назад',()=>go(sc.back)));
  page.append(act);$screen.append(page);$screen.scrollTop=0;
}

// Дом ловцов: воскрешение погибших питомцев — на выбор: бесплатно с ожиданием (reviveMin) или сразу за монеты (revivePrice), см. data.js.
function reviveScreen(sc,note=''){
  hud();$screen.innerHTML='';
  const page=mk('page'),body=mk('body','<h2>Воскрешение</h2>');
  if(note)body.append(mk('log',note));
  page.append(body);
  const act=mk('actions'),dead=S.pets.filter(p=>p.dead),now=Date.now(),busy=dead.some(p=>p.reviveAt);   // бесплатно — только одного питомца за раз
  if(!dead.length)act.append(mk('dim','Погибших питомцев нет.'));
  dead.forEach(p=>{
    const m=ENEMIES[p.species].icon+' '+petName(p),price=revivePrice(p,S.lvl),min=reviveMin(p),poor=coins(S)<price;
    const paid=()=>{const b=btn(`Сразу: ${m}`,()=>{const r=doOp({op:'revive',id:p.id,pay:true});reviveScreen(sc,r.ok?`${m} снова на ногах. Заплачено: ${price} ${coinIcon()}.`:r.msg);},poor?'dimmed':'primary',poor?`Не хватает монет: нужно ${price} ${coinIcon()}`:`${price} ${coinIcon()}`);if(poor)b.disabled=true;return b;};
    if(now>=(p.reviveAt||Infinity))act.append(btn(`Забрать: ${m}`,()=>{const r=doOp({op:'revive_take',id:p.id});reviveScreen(sc,r.ok?`${m} снова на ногах.`:r.msg);},'primary','Готов'));
    else if(p.reviveAt){const left=Math.ceil((p.reviveAt-now)/60000);act.append(btn(`${m}`,()=>reviveScreen(sc),'dimmed',`Вернётся примерно через ${left} ${plural(left,'минуту','минуты','минут')}`),paid());}
    else{
      act.append(paid());
      if(busy)act.append(btn(`Подождать: ${m}`,()=>reviveScreen(sc),'dimmed','Инструктор занят другим питомцем'));
      else act.append(btn(`Подождать: ${m}`,()=>{const r=doOp({op:'revive',id:p.id});reviveScreen(sc,r.ok?`Питомец оставлен у инструктора. Вернуться за ним можно через ${min} ${plural(min,'минуту','минуты','минут')}.`:r.msg);},'',`Бесплатно · ${min} ${plural(min,'минута','минуты','минут')}`));
    }
  });
  act.append(btn('← Назад',()=>go(sc.back)));
  page.append(act);$screen.append(page);$screen.scrollTop=0;
}

// Харчевня: приготовить блюдо по рецептам из сумки. Шанс бросает сервер (как у крафта), рецепт исчезает всегда, при неудаче — и продукты.
const cookNote=res=>res.win?`Готово: ${iic(ITEMS[res.result])} ${ITEMS[res.result].name}`:'Не вышло: всё подгорело. Рецепт и продукты пропали.';
async function cookRecipe(id){
  if(serverOn()){const r=await serverCraft(id,'cook');hud();return r.ok?cookNote(r.res):r.msg;}
  const r=applyOp(S,{op:'cook',id,seed:(Math.random()*4294967296)>>>0});
  if(!r.ok)return r.msg;
  save();hud();return cookNote(r.res);
}
function cookScreen(sc,note=''){
  hud();$screen.innerHTML='';
  const page=mk('page'),body=mk('body','<h2>Приготовить</h2>');
  if(note)body.append(mk('log',note));
  page.append(body);
  const act=mk('actions'),ids=Object.keys(S.inv).filter(id=>ITEMS[id]?.cook&&S.inv[id]>0);
  if(!ids.length)act.append(mk('dim','Рецептов блюд нет. Их продают тут же, у стойки.'));
  ids.forEach(id=>{
    const r=ITEMS[id].cook,res=ITEMS[r.result],can=craftable(S,r);
    const mats=Object.entries(r.ingredients).map(([k,n])=>{const have=S.inv[k]||0;return `${ITEMS[k].name}: <span class="${have>=n?'pos':'neg'}">${have}/${n}</span>`;}).join(' · ');
    const b=btn(`${iic(res)} ${res.name} · рецептов: ${S.inv[id]}`,()=>cookRecipe(id).then(n=>cookScreen(sc,n)),can?'primary':'dimmed',`Шанс ${r.chance}% · ${mats}`);
    if(!can)b.disabled=true;
    act.append(attachTip(b,tipItem(res,'')));
  });
  act.append(btn('← Назад',()=>go(sc.back)));
  page.append(act);$screen.append(page);$screen.scrollTop=0;
}
// Инвентарь: перемолоть предмет (хвосты → мука), выбор количества
function grindScreen(id,back){
  const it=ITEMS[id],into=ITEMS[it.grind],q=S.inv[id]||0;
  $screen.innerHTML='';
  $screen.append(el(`<h2>Перемолоть в муку</h2><div class="text"><p>${iic(it)} ${it.name}: ${q} шт. Из каждого выйдет ${iic(into)} 1 ${into.name.toLowerCase()}.</p></div>`));
  const go_=n=>{const r=doOp({op:'grind',id,n});inventoryScreen(back,r.ok?`Перемолото: ${it.name} ×${r.res.q} → ${into.name} +${r.res.q}`:r.msg);};
  [1,3,5,10].filter(n=>n<q).forEach(n=>$screen.append(btn(`×${n}`,()=>go_(n))));
  if(q>0)$screen.append(btn(`Все (×${q})`,()=>go_(q),'primary'));
  $screen.append(btn('← Назад',()=>inventoryScreen(back)));
}
// Сколько осталось действовать еде (минуты) — для окна персонажа и инвентаря
const buffLeftMin=()=>S.buff&&S.buff.until>Date.now()?Math.ceil((S.buff.until-Date.now())/60000):0;

// Дом ловцов: продажа питомцев. Питомец в клети (слот) в списке не показывается; отданного на воскрешение продать нельзя; погибший — за полцены.
function petSellScreen(sc,note=''){
  hud();$screen.innerHTML='';
  const page=mk('page'),body=mk('body','<h2>Продать питомца</h2><div class="text"><p>Инструктор окидывает клети взглядом: — Лишних пристрою в хорошие руки. И павших возьму, но за полцены.</p></div>');
  if(note)body.append(mk('log',note));
  page.append(body);
  const act=mk('actions');
  const list=S.pets.filter(p=>p.id!==S.pet);
  if(!list.length)act.append(mk('dim','Продавать некого.'));
  list.forEach(p=>{
    const m=ENEMIES[p.species].icon+' '+petName(p)+(p.dead?' · погиб':''),price=petPrice(p);
    if(p.reviveAt)act.append(btn(m,()=>petSellScreen(sc),'dimmed','Сейчас у инструктора на воскрешении'));
    else act.append(attachTip(btn(m,()=>{
      if(!confirm(`Продать ${petName(p)}${p.dead?' (погиб)':''} за ${price} бронзовых?`))return;
      const r=doOp({op:'sell_pet',id:p.id});
      petSellScreen(sc,r.ok?`Продано: ${petName(p)}. Получено: +${r.res.sum} ${coinIcon()}`:r.msg);
    },'',`Продать за ${price} ${coinIcon()}`),tipPet(p)));
  });
  act.append(btn('← Назад',()=>go(sc.back)));
  page.append(act);$screen.append(page);$screen.scrollTop=0;
}

// Лавка «Богатый Искатель»: продажа предметов из сумки. Экипированное не продаётся.
function sellScreen(sc,note=''){
  hud();$screen.innerHTML='';
  const page=mk('page'),body=mk('body','<h2>Продажа</h2>');
  if(note)body.append(mk('log',note));
  page.append(body);
  const act=mk('actions'),sum=junkSum(S);
  const jb=btn(`Продать весь хлам (+${sum} ${coinIcon()})`,()=>{
    const r=doOp({op:'sellJunk'});
    sellScreen(sc,r.ok?`Продано: ${r.res.sold.join(', ')}. Получено: +${r.res.sum} ${coinIcon()}`:r.msg);
  },'primary');
  if(!sum){jb.disabled=true;jb.querySelector('small')||jb.insertAdjacentHTML('beforeend','<small>Хлама нет</small>');}
  act.append(jb);
  const ids=Object.keys(S.inv).filter(id=>sellQty(S,id)>0);
  if(!ids.length)act.append(mk('dim','Сумка пуста: продавать нечего.'));
  const sellN=(id,k)=>{
    const r=doOp({op:'sell',id,n:k});
    sellScreen(sc,r.ok?`Продано: ${r.res.name} ×${r.res.q}. Получено: +${r.res.sum} ${coinIcon()}`:r.msg);
  };
  ids.forEach(id=>{
    const it=ITEMS[id],q=sellQty(S,id),row=mk('irow');
    row.append(btn(`${itemName(it)} ×${q}`,()=>sellN(id,1),'',`Продать 1 шт. за ${it.sell} ${coinIcon()}`));
    [[5,'×5'],[q,'Все']].filter(([k],i)=>i===1?q>1:q>5).forEach(([k,label])=>{
      const b=document.createElement('button');b.className='pm wide';b.type='button';b.textContent=label;b.onclick=()=>sellN(id,k);row.append(b);});
    act.append(row);
  });
  act.append(btn('← Назад',()=>go(sc.back)));
  page.append(act);$screen.append(page);$screen.scrollTop=0;
}

function shopScreen(sc){
  const draw=(note='')=>{
    $screen.innerHTML='';hud();
    if(sc.image)$screen.append(mk('scene-img',`<img src="${pic(sc.image)}" alt=""${sc.zoom?' data-zoom':''}${sc.imagePos?` style="object-position:${sc.imagePos}"`:''}>`));
    if(sc.text)$screen.append(el(`<div class="text"><p>${sc.text}</p></div>`));
    if(note)$screen.append(el(`<div class="log">${note}</div>`));
    sc.stock.filter(id=>!ITEMS[id].path||ITEMS[id].path===S.path).forEach(id=>{   // вещи и рецепты чужого пути не показываются
      const it=ITEMS[id],have=S.inv[id]||0,owned=!it.use&&!it.stack&&have>=(it.maxOwn||1),price=itemPrice(it,S);
      const b=btn(`${iic(it)} ${it.name} — ${price} ${coinIcon()}${it.stack?(have?` (в сумке ${have})`:''):!it.use&&have?` (куплено${it.maxOwn>1?' '+have+'/'+it.maxOwn:''})`:''}`,()=>{
        const r=doOp({op:'buy',id});
        draw(r.ok?`Куплено: ${it.cook||it.recipe?`Рецепт «${it.name.replace(/^Рецепт: /,'')}»`:it.name}`:r.msg);
      },'',it.use?`Лечит ${it.use.healPct}% здоровья`:it.food?`+${it.food.pct}% к урону, защите, криту и уклонению на ${it.food.min} мин`:it.cook?`Ингредиенты: ${Object.entries(it.cook.ingredients).map(([k,n])=>`${ITEMS[k].name} ×${n}`).join(', ')}`:it.recipe?`Нужно: ${Object.entries(it.recipe.ingredients).map(([k,n])=>`${ITEMS[k].name} ×${n}`).join(', ')}`:bonusText(it.bonus||{})+(it.minLvl?` · нужен ${it.minLvl}-й уровень`:''));
      if(coins(S)<price||owned)b.disabled=true;
      $screen.append(b);
    });
    $screen.append(btn('← Назад',()=>go(sc.back)));
    const zi=$screen.querySelector('img[data-zoom]');if(zi)setupZoom(zi,sc,true);
  };
  draw();
}


// ---------- чат мира ----------
// Сервер хранит последние 100 сообщений за 2 суток (supabase/schema-chat.sql); правила и фильтр — js/chat.js.
// Пока экран открыт, раз в CHAT.POLL_MS миллисекунд спрашиваем новые сообщения. Без сервера (локальная версия) — демонстрационный чат.
let chatS=null;
const chatMock={id:3,msgs:[{id:1,nick:'Страж',lvl:7,text:'Добро пожаловать в Агинду.',t:0},{id:2,nick:'Ловец_Рэн',lvl:4,text:'Кто идёт в катакомбы? Нужен третий.',t:0}]};
const chatClock=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
const chatLeft=sec=>sec>=3600?Math.ceil(sec/3600)+' ч':sec>=60?Math.ceil(sec/60)+' мин':Math.max(1,Math.ceil(sec))+' с';
async function chatCall(action,body){
  if(serverOn())return serverCall(action,body);
  // демонстрация без сервера: сообщения видны только на этом устройстве, лимитов нет
  if(action==='chat_list'){const now=Date.now();chatMock.msgs.forEach(m=>{if(!m.t)m.t=now-60000;});return {status:200,ok:true,msgs:chatMock.msgs.filter(m=>m.id>(body.after||0)),del:[],ban:null,wait:0,admin:isAdmin(),nick:S.name};}
  if(action==='chat_send'){const c=chatCheck(body.text);if(!c.ok)return {status:200,ok:false,error:c.error,ban:c.error==='bad'?{perm:false,left_s:3600}:undefined};chatMock.msgs.push({id:chatMock.id++,nick:S.name,lvl:S.lvl,text:c.text,t:Date.now()});return {status:200,ok:true};}
  if(action==='chat_profile')return {status:200,ok:true,p:{nick:body.nick,gender:'n',lvl:5,wins:12,losses:3,title:'Младший Искатель',clan:null,equip:{weapon:'dagger',offhand:'shield',helmet:'helmet_cracked'}}};
  if(action==='chat_delete'){chatMock.msgs=chatMock.msgs.filter(m=>m.id!==body.id);return {status:200,ok:true};}
  return {status:200,ok:true};
}
function chatScreen(back){
  hideTip();clearTimer();
  const st=chatS={back,after:0,msgs:new Map(),waitUntil:0,ban:null,banAt:0,admin:false,me:S.name,err:'',busy:false,open:null,first:true};
  $screen.innerHTML='';
  const page=mk('page chat');
  page.append(el('<h2>Чат мира</h2>'));
  if(!serverOn())page.append(mk('chat-note','Тестовый режим без сервера: сообщения видите только вы.'));
  st.list=mk('chat-list');page.append(st.list);
  st.status=mk('chat-status');page.append(st.status);
  const form=mk('chat-form');
  st.input=document.createElement('input');st.input.type='text';st.input.className='fld';st.input.maxLength=CHAT.MAX_LEN;st.input.placeholder='Сообщение…';st.input.autocomplete='off';
  st.send=btn('Отправить',()=>chatSend(st),'primary');
  st.input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();chatSend(st);}});
  st.input.addEventListener('input',()=>{st.err='';chatTick(st);});
  form.append(st.input,st.send);page.append(form);
  st.cnt=mk('chat-cnt','');page.append(st.cnt);
  page.append(btn('← Назад',()=>go(back)));
  $screen.append(page);st.root=page;
  chatTick(st);
  st.tick=setInterval(()=>{if(!st.root.isConnected||chatS!==st){clearInterval(st.tick);return;}chatTick(st);},1000);
  chatPoll(st);
}
async function chatPoll(st){
  while(st.root.isConnected&&chatS===st){
    await chatLoad(st);
    for(let i=0;i<CHAT.POLL_MS/250&&st.root.isConnected&&chatS===st&&!st.kick;i++)await sleepMs(250);
    st.kick=false;
  }
}
async function chatLoad(st){
  const r=await chatCall('chat_list',{after:st.after});
  if(!st.root.isConnected||chatS!==st)return;
  if(r.status!==200||!r.ok){st.offline=true;chatTick(st);return;}
  st.offline=false;
  let changed=false;
  (r.msgs||[]).forEach(m=>{if(!st.msgs.has(m.id)){st.msgs.set(m.id,m);changed=true;}st.after=Math.max(st.after,m.id);});
  (r.del||[]).forEach(id=>{if(st.msgs.delete(id))changed=true;});
  while(st.msgs.size>CHAT.KEEP){st.msgs.delete(st.msgs.keys().next().value);changed=true;}
  st.admin=!!r.admin;if(r.nick)st.me=r.nick;
  st.ban=r.ban||null;st.banAt=Date.now();st.waitUntil=Date.now()+(r.wait||0)*1000;
  if(changed||st.first)chatRender(st);
  st.first=false;chatTick(st);
}
function chatRender(st){
  const l=st.list,atBottom=st.first||l.scrollHeight-l.scrollTop-l.clientHeight<48;
  l.innerHTML='';
  if(!st.msgs.size)l.append(mk('chat-empty','Пока тихо. Напишите первым.'));
  [...st.msgs.values()].sort((a,b)=>a.id-b.id).forEach(m=>{
    const row=mk('cm'+(m.nick===st.me?' me':'')),n=document.createElement('button');
    n.type='button';n.className='cn';n.textContent=m.lvl?`${m.nick} [${m.lvl}${PATHS[m.path]?' · '+PATHS[m.path].short:''}]`:m.nick;n.onclick=()=>chatProfile(st,m.nick);   // в чате только имя и уровень
    const t=document.createElement('span');t.className='ct';t.textContent=chatClock(m.t);
    const x=document.createElement('span');x.className='cx';x.textContent=m.text;
    row.append(t,n,x);
    if(st.admin){
      const mod=document.createElement('button');mod.type='button';mod.className='cmod';mod.textContent='⋯';mod.setAttribute('aria-label','Модерация');
      mod.onclick=()=>{st.open=st.open===m.id?null:m.id;chatRender(st);};row.append(mod);
      if(st.open===m.id){
        const bar=mk('cbar');
        [['Удалить',()=>chatMod(st,'chat_delete',{id:m.id})],['Бан 1 ч',()=>chatMod(st,'chat_ban',{nick:m.nick,minutes:60})],['Бан 1 сут',()=>chatMod(st,'chat_ban',{nick:m.nick,minutes:1440})],['Навсегда',()=>chatMod(st,'chat_ban',{nick:m.nick,minutes:-1})],['Снять бан',()=>chatMod(st,'chat_ban',{nick:m.nick,minutes:0})]]
          .forEach(([label,fn])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;bar.append(b);});
        row.append(bar);
      }
    }
    l.append(row);
  });
  if(atBottom)l.scrollTop=l.scrollHeight;
}
async function chatMod(st,action,body){
  const r=await chatCall(action,body);
  st.open=null;
  if(r.status!==200||!r.ok){st.err='Не удалось выполнить действие.';chatTick(st);return;}
  if(action==='chat_delete')st.msgs.delete(body.id);
  st.err=action==='chat_ban'?(body.minutes===0?'Бан снят.':'Игрок заблокирован.'):'Сообщение скрыто.';
  chatRender(st);chatTick(st);
}
// Состояние под списком: блокировка, пауза до следующего сообщения, ошибки; подпись и доступность кнопки отправки
function chatTick(st){
  const now=Date.now(),banned=st.ban&&(st.ban.perm||st.ban.left_s-(now-st.banAt)/1000>0),wait=Math.ceil((st.waitUntil-now)/1000);
  let msg=st.err;
  if(banned)msg=st.ban.perm?'Вы заблокированы в чате навсегда.':`Вы заблокированы в чате: осталось ${chatLeft(st.ban.left_s-(now-st.banAt)/1000)}.`;
  else if(st.offline&&!msg)msg='Нет связи с чатом, пробуем снова…';
  st.status.textContent=msg||'';st.status.style.display=msg?'':'none';
  const len=[...st.input.value].length;
  st.cnt.textContent=`${len}/${CHAT.MAX_LEN}`;
  st.send.disabled=!!banned||st.busy||(wait>0&&!st.admin)||!st.input.value.trim();
  st.send.textContent=banned?'Заблокирован':wait>0&&!st.admin?`Через ${wait} с`:'Отправить';
  st.input.disabled=!!banned;
}
async function chatSend(st){
  if(st.send.disabled)return;
  const text=st.input.value,c=chatCheck(text);
  if(!c.ok&&c.error!=='bad'){st.err={empty:'Напишите сообщение.',long:`Не больше ${CHAT.MAX_LEN} знаков.`,link:'Ссылки и @упоминания в чате запрещены.'}[c.error];chatTick(st);return;}
  st.busy=true;st.err='';chatTick(st);
  const r=await chatCall('chat_send',{text});
  st.busy=false;
  if(!st.root.isConnected||chatS!==st)return;
  if(r.status===200&&r.ok){st.input.value='';st.waitUntil=Date.now()+CHAT.GAP_S*1000;st.kick=true;chatLoad(st);return;}
  if(r.status===0)st.err='Нет связи с сервером. Сообщение не отправлено.';
  else if(r.error==='wait'){st.waitUntil=Date.now()+(r.wait||CHAT.GAP_S)*1000;st.err='';}
  else if(r.error==='banned'){st.ban={perm:!!r.perm,left_s:r.left_s||0};st.banAt=Date.now();}
  else if(r.error==='bad'){st.input.value='';if(r.ban){st.ban=r.ban;st.banAt=Date.now();}st.err='Недопустимое слово. Сообщение не отправлено, вы заблокированы в чате.';}
  else st.err={empty:'Напишите сообщение.',long:`Не больше ${CHAT.MAX_LEN} знаков.`,link:'Ссылки и @упоминания в чате запрещены.',rate:'Слишком часто. Подождите немного.'}[r.error]||'Не удалось отправить сообщение.';
  chatTick(st);
}
// Окно чужого персонажа: уровень, победы и поражения, титул, клан, надетое (без здоровья, монет, сумки и питомцев)
async function chatProfile(st,nick){
  $screen.innerHTML='';$screen.append(el(`<h2>${nick.replace(/[<>&]/g,'')}</h2><p class="dim">Загружаем…</p>`));
  const r=await chatCall('chat_profile',{nick});
  if(r.status!==200||!r.ok){$screen.innerHTML='';$screen.append(el('<h2>Персонаж</h2>'),el(`<p class="text">${r.error==='not_found'?'Игрок не найден.':'Не удалось загрузить профиль.'}</p>`),btn('← К чату',()=>chatScreen(st.back),'primary'));return;}
  profileScreen(r.p,()=>chatScreen(st.back));
}
function profileScreen(p,onBack){
  $screen.innerHTML='';
  const view={equip:p.equip||{}},page=mk('page charpage');
  const h=mk('body');h.append(Object.assign(document.createElement('h2'),{textContent:p.nick}));page.append(h);
  const heroImg=p.gender==='m'?'pictures/hero-male.png':p.gender==='f'?'pictures/hero-female.png':null;
  const paper=mk('paper',`<div class="fig${heroImg?' img':''}">${heroImg?`<img src="${pic(heroImg)}" alt="">`:portraitSVG(p.gender)}</div>`);
  Object.entries(SLOT_POS).forEach(([k,pos])=>{const b=slotButton(k,null,view);b.style[pos.side==='l'?'left':'right']='0';b.style.top=pos.y+'%';paper.append(b);});
  const left=mk('pcol');left.append(paper);
  const row=(k,v)=>`<div><span>${k}</span><b></b></div>`;
  const stats=mk('cstats',row('Уровень')+row('Путь')+row('Победы')+row('Поражения')+row('Титул')+row('Клан'));
  const vals=[p.lvl,PATHS[p.path]?PATHS[p.path].name:'—',p.wins,p.losses,p.title||'—',p.clan||'—'];
  stats.querySelectorAll('b').forEach((b,i)=>{b.textContent=vals[i];});
  const wrap=mk('char-wrap');wrap.append(left,stats);page.append(wrap);
  const jr=mk('jrow');['necklace','ring1','ring2','earring1','earring2','cage'].forEach(k=>jr.append(slotButton(k,null,view)));page.append(jr);
  const act=mk('actions');act.append(btn('← К чату',onBack,'primary'));page.append(act);
  $screen.append(page);
}

// ---------- бой ----------
const TURN_MS=25000;   // время на выбор удара и защиты
function clearTimer(){if(C&&C.timer){clearInterval(C.timer);C.timer=null;}}

function startCombat(sc){
  regenHp(S);
  if(stam(S)<STAM_COST)return noStrength(stam(S),stamWaitMin(S,STAM_COST));
  const en=sc.combat.enemy,mode=sc.combat.mode||null;let id=typeof en==='function'?en(S):en;
  let opts={};
  if(mode==='escort'){   // задание сопровождения: враги из escortFoes по очереди, клеть выключена
    if(dailyState(S)!=='taken'){$screen.innerHTML='';$screen.append(el('<h2>Отряд ушёл</h2><div class="text"><p>Задание сегодня уже выполнено или недоступно.</p></div>'),btn('В переулок',()=>go('alley'),'primary'));return;}
    const foes=escortFoes(S);id=foes[0];opts={mode,queue:foes.slice(1),noCapture:true};
  }
  if(serverOn()){   // бой считает сервер: он списывает выносливость и выдаёт seed
    $screen.innerHTML='';$screen.append(el('<h2>Бой</h2><div class="text"><p>Идёт подготовка к бою…</p></div>'));
    serverCombatStart(id,mode).then(r=>{
      if(r.error==='reloaded')return;
      if(r.ok)return beginCombat(sc,id,r.seed,opts);
      if(r.error==='stam')return noStrength(stam(S),r.wait||1);
      $screen.innerHTML='';
      $screen.append(el(`<h2>Нет связи</h2><div class="text"><p>${r.error==='network'?'Для боя нужна связь с сервером. Проверьте интернет и попробуйте ещё раз.':'Сервер не принял бой. Попробуйте ещё раз.'}</p></div>`));
      $screen.append(btn('Повторить',()=>startCombat(sc),'primary'),btn('Вернуться на площадь',()=>go('city_center')));
    });
    return;
  }
  spendStam(S,STAM_COST);
  if(mode==='escort'){S.daily=S.daily||{};S.daily.escortSt='fight';}
  beginCombat(sc,id,(Math.random()*4294967296)>>>0,opts);
}
const waitText=m=>m>=60?`${Math.floor(m/60)} ${plural(Math.floor(m/60),'час','часа','часов')}${m%60?` ${m%60} мин`:''}`:`${m} ${plural(m,'минуту','минуты','минут')}`;
function noStrength(cur,m){
  const full=stamWaitMin(S,maxStam(S));
  $screen.innerHTML='';
  $screen.append(el(`<h2>Нет сил</h2><div class="text"><p>На следующий бой сил хватит примерно через ${waitText(m)}, до полной выносливости ждать ещё ${waitText(full)}.</p>
    <p>Выносливость (⚡) растёт сама, по одному очку в минуту, даже пока игра закрыта. Пока ждёте, можно заглянуть в лавку или к ремесленнице, свести питомцев в Доме ловцов или поговорить в чате.</p></div>
    <p class="dim">Выносливость: ${cur}/${maxStam(S)}. Бой требует ${STAM_COST}.</p>`));
  $screen.append(btn('Вернуться на площадь',()=>go('city_center'),'primary'));
}
function beginCombat(sc,id,seed,opts={}){
  inFight=true;save();hud();clearTimer();
  C={...newCombat(S,id,{...opts,now:Date.now()}),sc,seed,R:makeRng(seed),choices:[],sel:{atk:null,def:null,capture:false},ui:{}};
  buildCombat();newTurn();
}
// Кадр картинки врага: верхний край чуть выше головы (frame.head), ниже — тело, насколько хватает высоты окна;
// если окно такое низкое, что лицо (head…chin) не помещается целиком, кадр центрируется на лице. Считается при загрузке и при изменении размера.
function frameFoe(img,fr){
  const f=fr||{head:0.1,chin:0.5},apply=()=>{
    const box=img.parentNode,W=img.naturalWidth,H=img.naturalHeight,bw=box.clientWidth,bh=box.clientHeight;
    if(!W||!bw||!bh)return;
    const v=bh/(H*bw/W);   // какая доля высоты картинки видна (ширина окна заполнена целиком)
    if(v>=1){img.style.objectPosition='center 50%';return;}
    let top=Math.max(0,f.head-0.02);   // чуть выше макушки
    if(f.chin-top>v)top=(f.head+f.chin)/2-v/2;   // лицо не влезает — центр на лице
    top=Math.min(Math.max(0,top),1-v);
    img.style.objectPosition=`center ${(top/(1-v)*100).toFixed(1)}%`;
  };
  img._frame=apply;
  if(img.complete&&img.naturalWidth)apply();else img.addEventListener('load',apply,{once:true});
  if(window.ResizeObserver)new ResizeObserver(apply).observe(img.parentNode);   // высота окна врага меняется вместе с экраном Telegram
}
window.addEventListener('resize',()=>document.querySelectorAll('.foe-img img').forEach(i=>i._frame&&i._frame()));
// Экран боя собирается один раз и дальше только обновляется (лог не прыгает, таймер не мигает)
function buildCombat(){
  hud();$screen.innerHTML='';
  const e=C.e,u=C.ui,page=mk('page fight');
  page.append(mk('foe-win',`${e.image?`<div class="foe-img"><img src="${pic(e.image)}" alt="" onerror="this.parentNode.remove()"></div>`:''}
    <div class="foe-info"><div class="foe-line"><span class="name">${e.boss?'👑 ':''}${e.name} <span class="dim">· ${e.level} ур.${C.total>1?` · враг ${C.total-C.queue.length} из ${C.total}`:''}</span></span><span class="hptxt"></span></div>
    <div class="bar fbar"><i></i></div></div>`));
  u.hpFill=page.querySelector('.fbar i');u.hpTxt=page.querySelector('.hptxt');
  u.log=mk('log');page.append(u.log);
  u.tbar=mk('turn','<div class="tbar"><i></i></div><span class="tnum"></span>');page.append(u.tbar);
  u.zb={};
  [['atk','⚔ Удар'],['def','🛡 Защита']].forEach(([kind,label])=>{
    const row=mk('zrow',`<span class="zl">${label}</span>`);u[kind+'Row']=row;
    ZK.forEach(z=>{const b=btn(ZONES[z].label,()=>{C.sel[kind]=z;if(kind==='atk')C.sel.capture=false;refreshCombat();});u.zb[kind+z]=b;row.append(b);});
    page.append(row);
  });
  u.acts2=mk('acts2');
  if(S.equip.cage&&!C.noCapture){
    u.cage=btn('',()=>{C.sel.capture=!C.sel.capture;if(C.sel.capture)C.sel.atk=null;refreshCombat();});u.acts2.append(u.cage);
  }
  if(C.aux.length){u.pot=btn('',()=>{C.sel.potion=!C.sel.potion;refreshCombat();});u.acts2.append(u.pot);}
  u.ret=btn('↩ Отвести питомца',()=>{C.petRetreat=true;refreshCombat();});u.acts2.append(u.ret);
  page.append(u.acts2);
  // здоровье: герой (зелёная полоска), под ним питомец
  const me=mk('my-line','<span class="mytxt"></span><div class="bar mybar"><i></i></div>');page.append(me);
  u.myFill=me.querySelector('i');u.myTxt=me.querySelector('.mytxt');
  u.petLine=mk('pet-line','<span class="pn"></span><div class="pbar"><i></i></div><span class="ph"></span>');page.append(u.petLine);
  u.go=btn('Сделать ход',commitRound,'primary');
  const acts=mk('acts');acts.append(u.go,btn('🏃 Бежать',fleeCombat));
  page.append(acts);$screen.append(page);
  const fi=page.querySelector('.foe-img img');if(fi)frameFoe(fi,ENEMIES[C.id]&&ENEMIES[C.id].frame);
}
function fleeCombat(){
  if(C&&C.mode==='escort'&&!confirm('Побег провалит задание сопровождения. Бежать?'))return;
  if(serverOn()&&C&&inFight){const pre=JSON.parse(JSON.stringify(S));serverCombatEnd(pre,C.choices);}
  const back=(C&&C.sc&&C.sc.combat&&C.sc.combat.resume)||'city_center';   // герой остаётся на той же локации, откуда начал бой
  go(back,['Вы вырываетесь из боя.']);
}
function refreshCombat(){
  const e=C.e,u=C.ui,pet=C.pet;
  u.hpFill.style.width=Math.max(0,e.cur)/e.hp*100+'%';u.hpTxt.textContent=Math.max(0,Math.round(e.cur))+'/'+e.hp;
  u.myFill.style.width=Math.max(0,S.hp)/maxHp(S)*100+'%';u.myTxt.textContent='❤ '+Math.max(0,S.hp)+'/'+maxHp(S);
  u.log.innerHTML=C.log.slice(-80).map(l=>`<div>${l}</div>`).join('');u.log.scrollTop=u.log.scrollHeight;
  u.petLine.style.display=pet?'':'none';
  if(pet){u.petLine.querySelector('.pn').textContent=ENEMIES[pet.species].icon+' '+petName(pet);
    u.petLine.querySelector('.pbar i').style.width=Math.max(0,pet.cur)/pet.hp*100+'%';u.petLine.querySelector('.ph').textContent=Math.max(0,pet.cur)+'/'+pet.hp;}
  ZK.forEach(z=>{u.zb['atk'+z].classList.toggle('sel',C.sel.atk===z);u.zb['def'+z].classList.toggle('sel',C.sel.def===z);u.zb['atk'+z].disabled=!!C.sel.capture;});
  u.atkRow.classList.toggle('off',!!C.sel.capture);   // клеть вместо удара: удар недоступен
  $screen.querySelector('.fight')?.classList.remove('locked','anim-guard');
  const showCage=!!u.cage&&!C.captureUsed,showRet=!!pet&&pet.cur<pet.hp*0.3,showPot=!!u.pot&&C.aux.length>0;
  if(u.cage){u.cage.style.display=showCage?'':'none';u.cage.textContent=`🪤 Использовать клеть-ловушку · ${captureChance(S,e)}%`;u.cage.classList.toggle('sel',!!C.sel.capture);}
  u.ret.style.display=showRet?'':'none';u.ret.disabled=!!C.petRetreat;u.ret.textContent=C.petRetreat?'Питомец отступит в конце хода':'↩ Отвести питомца';
  if(u.pot){u.pot.style.display=showPot?'':'none';if(showPot){u.pot.textContent=`🧪 Выпить ${low(ITEMS[C.aux[0]].name).replace(' здоровья','')} (+${healAmount(S,C.aux[0])})`;u.pot.classList.toggle('sel',!!C.sel.potion);u.pot.disabled=S.hp>=maxHp(S);}}   // зелья в слоте может уже не быть (выпито в этом бою)
  u.acts2.style.display=(showCage||showRet||showPot)?'':'none';
  u.go.disabled=!C.sel.atk&&!C.sel.def&&!C.sel.capture&&!C.sel.potion;
  hud();
}
function newTurn(){
  C.sel={atk:null,def:null,capture:false,potion:false};C.deadline=Date.now()+TURN_MS;
  refreshCombat();tick();clearTimer();C.timer=setInterval(tick,200);
}
function tick(){
  if(!C||C.over||!C.ui.tbar)return;
  const left=Math.max(0,C.deadline-Date.now());
  C.ui.tbar.querySelector('i').style.width=left/TURN_MS*100+'%';
  C.ui.tbar.querySelector('.tnum').textContent=Math.ceil(left/1000)+' с';
  C.ui.tbar.querySelector('.tbar').classList.toggle('low',left<5000);
  if(left<=0)playRound(true);
}
// Нажатие «Сделать ход»: секунда анимации, потом расчёт раунда
function commitRound(){
  if(C.busy)return;
  C.busy=true;clearTimer();
  const page=$screen.querySelector('.fight'),foe=page.querySelector('.foe-win'),cap=C.sel.capture&&!C.captureUsed;
  page.classList.add('locked');
  if(cap)(foe.querySelector('.foe-img')||foe).insertAdjacentHTML('beforeend','<div class="cage-fx">🪤</div>');
  else if(C.sel.atk)foe.classList.add('anim-hit');
  else page.classList.add('anim-guard');
  setTimeout(()=>{foe.classList.remove('anim-hit');C.busy=false;if(C&&inFight)playRound(false);},1000);
}

// Итог боя: ход раунда считает ядро (core.js), здесь только экран
function playRound(timedOut){
  clearTimer();
  const ch={atk:C.sel.atk,def:C.sel.def,capture:C.sel.capture,potion:C.sel.potion,retreat:C.petRetreat,timedOut,restore:!!C.restoreFlag};C.restoreFlag=false;
  C.choices.push(ch);combatRound(C,S,ch,C.R);
  if(C.over==='win')return finish('win');
  if(C.over==='capture')return finish('capture');
  if(C.over==='lose')return finish('lose');
  if(C.advanced){C.advanced=false;save();buildCombat();newTurn();return;}   // следующий враг вышел вперёд
  save();newTurn();
}
function finish(outcome){
  inFight=false;clearTimer();
  const pre=serverOn()?JSON.parse(JSON.stringify(S)):null;   // состояние до награды: сервер сам проиграет бой и выдаст награду
  const res=applyOutcome(S,S,C,outcome,C.R);
  save();hud();
  if(pre)serverCombatEnd(pre,C.choices);
  if(outcome==='lose')return showLose(res);
  showWin(res);
}
// После боя: если питомец погиб, подсказать про воскрешение (бесплатно с ожиданием или сразу за монеты) и дать кнопку в Дом ловцов
function reviveHint(){
  const p=S.pets.find(x=>x.dead&&!x.reviveAt);if(!p)return;
  const price=revivePrice(p,S.lvl),min=reviveMin(p);
  $screen.append(el(`<div class="card">${ENEMIES[p.species].icon} ${petName(p)} <span class="tag">погиб</span><div class="dim" style="font-size:13px">Воскресить можно в Доме ловцов: сразу за ${price} ${coinIcon()} или бесплатно, подождав ${min} ${plural(min,'минуту','минуты','минут')}.</div></div>`));
  $screen.append(btn('Воскресить питомца',()=>go('lovtsy_revive'),''));
}
function showWin(res){
  const e=C.e,items=res.items,n=res.coinsN,cap=!!res.captured,notes=[...res.notes];
  let head='Победа',text;
  if(cap){
    notes.unshift(`Питомец: ${ENEMIES[res.captured.species].icon} ${petName(res.captured)}`);
    const f=e.gender==='f',nt=e.gender==='n';
    head='Зверь в клети';text=`${e.name} заперт${f?'а':nt?'о':''} в клети. Теперь ${f?'она':nt?'оно':'он'} ваш питомец.`;
  }else{
    const what=items.length?items.map(id=>ITEMS[id].name).join('; '):'Ничего';
    text=C.mode==='escort'?`Путь расчищен, отряд проходит дальше. Среди добычи вы находите: ${what}. Отнесите молочный зуб Рыцарю в Гильдию.`:`${e.name} бездыханно лежит у ваших ног. Осмотрев труп и окрестности, вы ${items.length?`находите: ${what}`:'ничего не находите'}.`;
  }
  const xpLines=res.xpLines;
  // общее окно дропа: монеты, предметы (подсказка с назначением при наведении), опыт
  const box=mk('drop');
  const row=(ic,name,val,tip)=>{const d=mk('drow',`<span class="di">${ic}</span><span class="dn">${name}</span><b>${val}</b>`);return tip?attachTip(d,tip):d;};
  if(n)box.append(row(iic(ITEMS.bronze_coin),ITEMS.bronze_coin.name,'+'+n,tipItem(ITEMS.bronze_coin,'')));
  items.forEach(id=>box.append(row(iic(ITEMS[id]),itemLabel(ITEMS[id]),'×1',tipItem(ITEMS[id],''))));
  xpLines.filter(l=>l.endsWith('опыта')).forEach(l=>box.append(row('✨','Опыт',l.replace(' опыта',''))));
  [...notes,...xpLines.filter(l=>!l.endsWith('опыта'))].forEach(l=>box.append(mk('drow note',l)));
  $screen.innerHTML='';
  $screen.append(el(`<h2>${head}</h2><div class="text"><p>${text}</p></div>`),box);
  reviveHint();
  C.sc.combat.after.forEach((a,i)=>$screen.append(btn(a.t,()=>go(a.to),i?'':'primary')));
}
function showLose(){
  const e=C.e;
  $screen.innerHTML='';
  $screen.append(el(`<h2>Поражение</h2><div class="text"><p>${e.name} сбивает вас с ног, и в глазах темнеет. Очнувшись, вы едва можете подняться.</p>${C.mode==='escort'?'<p>Задание сопровождения провалено. Новое можно будет взять завтра.</p>':''}</div>`));
  reviveHint();
  $screen.append(btn('Подняться',()=>go((C.sc&&C.sc.combat&&C.sc.combat.resume)||'city_center'),'primary'));   // герой остаётся на той же локации
}

setInterval(()=>{if(S)hud();},15000);
menu(true);   // админ-флаг приходит вместе с загрузкой сохранения (отдельный запрос не нужен)
