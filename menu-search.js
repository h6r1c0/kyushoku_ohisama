(function(){
  'use strict';
  const core=window.MenuSearchCore;
  // Only the dedicated six-column publication is exposed to this public app.
  const feed=window.OHISAMA_MENU_FEED||{};
  const source=feed.url||'';
  const shell=document.querySelector('.feature-shell'),quantityTab=document.getElementById('quantityTab'),menuTab=document.getElementById('menuTab');
  const tabs=[...shell.querySelectorAll('.feature-tabs [role="tab"][aria-controls]')];
  const categories=document.getElementById('menuCategories'),controls=document.getElementById('menuControls');
  const query=document.getElementById('menuQuery'),sort=document.getElementById('menuSort');
  const status=document.getElementById('menuStatus'),results=document.getElementById('menuResults'),detail=document.getElementById('menuDetail');
  let index=null,snapshot='',pending=null,category='',selected=null,yearMode=false,listScroll=0;
  const sortKey='ohisama-menu-sort',directionKey='ohisama-menu-date-direction',tabKey='ohisama-active-feature-tab';
  const cacheKey='ohisama-menu-public-csv-v1',maxCacheBytes=2*1024*1024;
  let cacheLoaded=false,cacheState='',baseStatus='';
  let dateDirection='new';
  try{
    const saved=localStorage.getItem(sortKey);
    if([...sort.options].some(o=>o.value===saved))sort.value=saved;
    const direction=localStorage.getItem(directionKey);
    if(direction==='new'||direction==='old')dateDirection=direction;
    else if(sort.value==='old')dateDirection='old';
  }catch(_){}
  // The select is enhanced by the main page before this module loads. Sync its
  // visible button after restoring the native value from local storage.
  sort.dispatchEvent(new Event('change'));
  const dateLabel=s=>`${Number(s.slice(0,4))}年${Number(s.slice(5,7))}月${Number(s.slice(8,10))}日`;
  function briefDate(s){
    const now=new Date(),date=new Date(Number(s.slice(0,4)),Number(s.slice(5,7))-1,Number(s.slice(8,10)));
    const anniversary=new Date(date);anniversary.setFullYear(date.getFullYear()+1);
    return now<anniversary?`${Number(s.slice(5,7))}/${Number(s.slice(8,10))}`:`${s.slice(0,4)}年`;
  }
  function button(label,className,action){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.addEventListener('click',action);return b;}
  function setStatus(value){baseStatus=value;status.textContent=value+(cacheState?`・${cacheState}`:'');}
  function setCacheState(value){cacheState=value;setStatus(baseStatus);}
  function checksum(text){let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return value>>>0;}
  function restoreCache(){
    if(cacheLoaded)return;
    cacheLoaded=true;
    try{
      const raw=localStorage.getItem(cacheKey);
      if(!raw)return;
      if(raw.length>maxCacheBytes)throw new Error('large cache');
      const saved=JSON.parse(raw);
      if(saved.version!==1||saved.source!==source||typeof saved.csv!=='string'||!saved.csv.length||saved.checksum!==checksum(saved.csv))throw new Error('invalid cache');
      const rows=core.csvRows(saved.csv);
      const restored=core.build(rows);
      if(!restored.dishes.length)throw new Error('empty cache');
      index=restored;snapshot=saved.csv;cacheState='更新確認中';
    }catch(_){try{localStorage.removeItem(cacheKey);}catch(_){} }
  }
  function saveCache(csv){
    try{
      const raw=JSON.stringify({version:1,source,csv,checksum:checksum(csv)});
      if(raw.length<=maxCacheBytes)localStorage.setItem(cacheKey,raw);
    }catch(_){/* Storage may be full or disabled; the in-memory index still works. */}
  }
  const yearButton=button('前年同時期','menu-year-trigger',()=>{yearMode=true;yearButton.classList.add('hidden');renderYear(true);});
  yearButton.classList.add('hidden');
  controls.after(yearButton);
  const yearView=document.createElement('div');yearView.id='menuYear';yearView.className='menu-year hidden';results.after(yearView);
  function validTab(id){return tabs.find(tab=>tab.id===id&&document.getElementById(tab.getAttribute('aria-controls')));}
  function showTab(id){
    const active=validTab(id)||quantityTab;
    shell.dataset.feature=active.dataset.feature||'quantity';
    for(const tab of tabs){
      const selected=tab===active,panel=document.getElementById(tab.getAttribute('aria-controls'));
      tab.setAttribute('aria-selected',String(selected));
      if(panel){panel.hidden=!selected;panel.classList.toggle('hidden',!selected);}
    }
    try{localStorage.setItem(tabKey,active.id);}catch(_){}
    if(active===menuTab){restoreCache();render();refresh().catch(()=>{});}
  }
  async function loadPublished(){
    if(!source)return Promise.reject(new Error('献立データの接続が未設定です'));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      // The published CSV permits anonymous CORS access and a five-minute HTTP cache.
      const response=await fetch(source,{cache:'default',signal:controller.signal});
      if(!response.ok)throw new Error('献立データを取得できませんでした');
      return await response.text();
    }finally{clearTimeout(timer);}
  }
  async function refresh(){
    if(pending)return pending;
    if(!index)setStatus('献立データを確認中…');
    else if(cacheState)setCacheState('更新確認中');
    pending=(async()=>{
      try{
        const csv=await loadPublished();
        if(index&&csv===snapshot){setCacheState('');return;}
        const rows=core.csvRows(csv),updated=core.build(rows);
        if(!updated.dishes.length)throw new Error('empty feed');
        index=updated;snapshot=csv;saveCache(csv);setCacheState('');
        render();
      }catch(error){
        if(index)setCacheState('更新未確認');
        else setStatus('献立データを取得できませんでした。量計算はそのまま使えます');
      }
      finally{pending=null;}
    })();
    return pending;
  }
  function render(){
    if(!index)return;
    controls.classList.toggle('hidden',yearMode);
    yearButton.classList.toggle('hidden',!category||!!selected||yearMode);
    if(selected){renderDetail();return;}
    if(yearMode){renderYear();return;}
    results.classList.remove('hidden');
    detail.classList.add('hidden');
    yearView.classList.add('hidden');
    results.replaceChildren();
    if(!category&&!query.value.trim()){setStatus('カテゴリーを選ぶか、料理名・食材名を入力してください');return;}
    const found=core.search(index,category,query.value,sort.value,dateDirection);
    setStatus(`${found.length}件の料理`);
    if(!found.length){setStatus('該当する料理はありません');return;}
    const fragment=document.createDocumentFragment();
    for(const dish of found){
      const b=button('','menu-result',()=>{listScroll=window.scrollY;selected=dish.key;renderDetail();detail.scrollIntoView({block:'start'});});
      const name=document.createElement('strong');name.textContent=dish.display;
      const meta=document.createElement('small');meta.textContent=`${dish.dates.length}回\n${briefDate(dish.dates[0])}`;
      b.append(name,meta);fragment.append(b);
    }
    results.append(fragment);
  }
  function renderYear(jump=false){
    controls.classList.add('hidden');
    results.classList.add('hidden');detail.classList.add('hidden');yearView.classList.remove('hidden');
    yearView.replaceChildren();
    const back=button('‹ 検索結果へ戻る','menu-back',()=>{yearMode=false;render();});
    const heading=document.createElement('strong');heading.textContent=`前年同時期｜${category}`;
    const head=document.createElement('div');head.className='menu-year-head';head.append(back,heading);yearView.append(head);
    const period=core.previousYear(index,category);
    const anchor=period.anchor?`${Number(period.anchor.slice(5,7))}/${Number(period.anchor.slice(8,10))}`:'';
    setStatus(period.dates.length?`${period.dates.length}日分・${period.target.replace(/-/g,'/')}以前の直近：${anchor}`:'前年の実績はありません');
    for(const date of period.dates){
      const dayItems=index.dates.get(date).filter(item=>item.category===category);
      for(const item of dayItems){
        const row=button('','menu-year-row',()=>{listScroll=window.scrollY;selected=item.key;renderDetail(date);detail.scrollIntoView({block:'start'});});
        const day=document.createElement('time');day.dateTime=date;day.textContent=`${date.slice(0,4)}/${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
        const name=document.createElement('span');name.textContent=item.name;
        row.append(day,name);if(date===period.anchor)row.classList.add('menu-year-anchor');
        yearView.append(row);
      }
    }
    if(jump&&period.anchor)yearView.querySelector('.menu-year-anchor')?.scrollIntoView({block:'center'});
  }
  function renderDetail(initialDate){
    const dish=index?.dishes.find(x=>x.key===selected);
    if(!dish){selected=null;render();return;}
    yearButton.classList.add('hidden');
    controls.classList.toggle('hidden',yearMode);
    const previousDate=detail.dataset.dishKey===dish.key?detail.querySelector('.menu-date')?.value:null;
    results.classList.add('hidden');yearView.classList.add('hidden');detail.classList.remove('hidden');detail.replaceChildren();
    detail.dataset.dishKey=dish.key;
    detail.append(button(yearMode?'‹ 前年同時期へ戻る':'‹ 検索結果へ戻る','menu-back',()=>{selected=null;render();window.scrollTo(0,listScroll);}));
    const title=document.createElement('h3');title.textContent=dish.display;detail.append(title);
    const picker=document.createElement('label');picker.className='menu-date-picker';picker.textContent='提供日';
    const dates=document.createElement('select');dates.className='menu-date';dates.setAttribute('aria-label','提供日');
    for(const date of dish.dates){const option=document.createElement('option');option.value=date;option.textContent=dateLabel(date);dates.append(option);}
    picker.append(dates);detail.append(picker);
    const day=document.createElement('div');day.className='menu-day';detail.append(day);
    function showDate(date){
      day.replaceChildren();
      const h=document.createElement('strong');h.textContent='同日の献立';day.append(h);
      const ul=document.createElement('ul');
      const items=[...(index.dates.get(date)||[])].sort((a,b)=>
        core.categories.indexOf(a.category)-core.categories.indexOf(b.category)||a.order-b.order);
      for(const item of items){const li=document.createElement('li'),label=document.createElement('span');label.textContent=`${item.category}　`;li.append(label,document.createTextNode(item.name));ul.append(li);}
      day.append(ul);
    }
    dates.addEventListener('change',()=>showDate(dates.value));
    if(initialDate&&dish.dates.includes(initialDate))dates.value=initialDate;
    else if(previousDate&&dish.dates.includes(previousDate))dates.value=previousDate;
    if(dish.dates.length)showDate(dates.value);
    setStatus(`${dish.dates.length}回提供`);
  }
  controls.classList.remove('hidden');
  for(const c of core.categories){const b=button(c,'menu-category',()=>{category=category===c?'':c;selected=null;yearMode=false;for(const item of categories.children)item.setAttribute('aria-pressed',String(item===b&&category===c));render();});b.setAttribute('aria-pressed','false');categories.append(b);}
  query.addEventListener('input',()=>{selected=null;yearMode=false;render();});
  sort.addEventListener('change',()=>{
    if(sort.value==='new'||sort.value==='old')dateDirection=sort.value;
    try{localStorage.setItem(sortKey,sort.value);localStorage.setItem(directionKey,dateDirection);}catch(_){}
    selected=null;yearMode=false;render();
  });
  for(const tab of tabs)tab.addEventListener('click',()=>showTab(tab.id));
  let savedTab='';try{savedTab=localStorage.getItem(tabKey)||'';}catch(_){}
  showTab(savedTab||quantityTab.id);
  const help=document.querySelector('#helpEditor .help-feature');
  if(help){
    const toggle=button('献立検索','help-feature-button menu-help-button',()=>{const open=copy.classList.toggle('hidden');toggle.setAttribute('aria-expanded',String(!open));});
    toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','menuHelpCopy');
    const copy=document.createElement('div');copy.id='menuHelpCopy';copy.className='menu-help-copy hidden';
    copy.textContent='カテゴリーを選ぶと候補が出ます。選ばずに料理名・食材名から全カテゴリーを検索することもできます。カテゴリー選択中の「前年同時期」から、前年の同じ季節の料理を見られます。料理を選び、提供日と同日の献立を確認できます。';
    help.append(toggle,copy);
  }
})();
