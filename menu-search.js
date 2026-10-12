(function(){
  'use strict';
  const core=window.MenuSearchCore;
  // Only the dedicated six-column publication is exposed to this public app.
  const feed=window.OHISAMA_MENU_FEED||{};
  const source=feed.url||'';
  const shell=document.querySelector('.feature-shell'),quantity=document.getElementById('quantityPanel');
  const menu=document.getElementById('menuPanel'),quantityTab=document.getElementById('quantityTab'),menuTab=document.getElementById('menuTab');
  const categories=document.getElementById('menuCategories'),controls=document.getElementById('menuControls');
  const query=document.getElementById('menuQuery'),sort=document.getElementById('menuSort');
  const status=document.getElementById('menuStatus'),results=document.getElementById('menuResults'),detail=document.getElementById('menuDetail');
  let index=null,snapshot='',pending=null,category='',selected=null;
  const sortKey='ohisama-menu-sort';
  try{const saved=localStorage.getItem(sortKey);if([...sort.options].some(o=>o.value===saved))sort.value=saved;}catch(_){}
  const dateLabel=s=>`${Number(s.slice(0,4))}年${Number(s.slice(5,7))}月${Number(s.slice(8,10))}日`;
  function briefDate(s){
    const now=new Date(),date=new Date(Number(s.slice(0,4)),Number(s.slice(5,7))-1,Number(s.slice(8,10)));
    const anniversary=new Date(date);anniversary.setFullYear(date.getFullYear()+1);
    return now<anniversary?`${Number(s.slice(5,7))}/${Number(s.slice(8,10))}`:`${s.slice(0,4)}年`;
  }
  function button(label,className,action){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.addEventListener('click',action);return b;}
  function setStatus(value){status.textContent=value;}
  function showTab(which){
    const active=which==='menu';shell.dataset.feature=which;
    quantity.hidden=active;quantity.classList.toggle('hidden',active);menu.hidden=!active;menu.classList.toggle('hidden',!active);
    quantityTab.setAttribute('aria-selected',String(!active));menuTab.setAttribute('aria-selected',String(active));
    if(active){refresh().catch(()=>{});render();}
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
    pending=(async()=>{
      try{
        const csv=await loadPublished();
        if(index&&csv===snapshot)return;
        const rows=core.csvRows(csv);index=core.build(rows);snapshot=csv;
        render();
      }catch(error){setStatus(index?'最新データを確認できません。前回取得した結果を表示しています':'献立データを取得できませんでした。量計算はそのまま使えます');}
      finally{pending=null;}
    })();
    return pending;
  }
  function render(){
    if(!index)return;
    if(selected){renderDetail();return;}
    results.classList.remove('hidden');
    detail.classList.add('hidden');
    results.replaceChildren();
    if(!category&&!query.value.trim()){setStatus('カテゴリーを選ぶか、料理名・食材名を入力してください');return;}
    const found=core.search(index,category,query.value,sort.value);
    setStatus(`${found.length}件の料理`);
    if(!found.length){setStatus('該当する料理はありません');return;}
    const fragment=document.createDocumentFragment();
    for(const dish of found){
      const b=button('','menu-result',()=>{selected=dish.key;renderDetail();});
      const name=document.createElement('strong');name.textContent=dish.display;
      const meta=document.createElement('small');meta.textContent=`${dish.dates.length}回\n${briefDate(dish.dates[0])}`;
      b.append(name,meta);fragment.append(b);
    }
    results.append(fragment);
  }
  function renderDetail(){
    const dish=index?.dishes.find(x=>x.key===selected);
    if(!dish){selected=null;render();return;}
    results.classList.add('hidden');detail.classList.remove('hidden');detail.replaceChildren();
    detail.append(button('‹ 検索結果へ戻る','menu-back',()=>{selected=null;results.classList.remove('hidden');render();}));
    const title=document.createElement('h3');title.textContent=dish.display;detail.append(title);
    const picker=document.createElement('label');picker.className='menu-date-picker';picker.textContent='提供日';
    const dates=document.createElement('select');dates.className='menu-date';dates.setAttribute('aria-label','提供日');
    for(const date of dish.dates){const option=document.createElement('option');option.value=date;option.textContent=dateLabel(date);dates.append(option);}
    picker.append(dates);detail.append(picker);
    const day=document.createElement('div');day.className='menu-day';detail.append(day);
    function showDate(date){
      day.replaceChildren();
      const own=(index.dates.get(date)||[]).filter(item=>item.key===dish.key);
      const original=document.createElement('div');original.className='menu-original';
      original.textContent=own.map(item=>item.name).join('／');day.append(original);
      const others=(index.dates.get(date)||[]).filter(item=>item.key!==dish.key);
      if(others.length){
        const h=document.createElement('strong');h.textContent='同日の献立';day.append(h);
        const ul=document.createElement('ul');for(const item of others){const li=document.createElement('li'),label=document.createElement('span');label.textContent=`${item.category}　`;li.append(label,document.createTextNode(item.name));ul.append(li);}day.append(ul);
      }
    }
    dates.addEventListener('change',()=>showDate(dates.value));
    if(dish.dates.length)showDate(dish.dates[0]);
    setStatus(`${dish.dates.length}回提供`);
  }
  controls.classList.remove('hidden');
  for(const c of core.categories){const b=button(c,'menu-category',()=>{category=category===c?'':c;selected=null;for(const item of categories.children)item.setAttribute('aria-pressed',String(item===b&&category===c));render();});b.setAttribute('aria-pressed','false');categories.append(b);}
  query.addEventListener('input',()=>{selected=null;results.classList.remove('hidden');render();});
  sort.addEventListener('change',()=>{try{localStorage.setItem(sortKey,sort.value);}catch(_){}selected=null;results.classList.remove('hidden');render();});
  quantityTab.addEventListener('click',()=>showTab('quantity'));
  menuTab.addEventListener('click',()=>showTab('menu'));
  const help=document.querySelector('#helpEditor .help-feature');
  if(help){
    const toggle=button('献立検索','help-feature-button menu-help-button',()=>{const open=copy.classList.toggle('hidden');toggle.setAttribute('aria-expanded',String(!open));});
    toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','menuHelpCopy');
    const copy=document.createElement('div');copy.id='menuHelpCopy';copy.className='menu-help-copy hidden';
    copy.textContent='カテゴリーを選ぶと候補が出ます。選ばずに料理名・食材名から全カテゴリーを検索することもできます。料理を選び、提供日の欄から過去の日と同日の献立を確認できます。';
    help.append(toggle,copy);
  }
})();
