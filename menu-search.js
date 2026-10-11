(function(){
  'use strict';
  const core=window.MenuSearchCore;
  // Only the dedicated six-column publication is exposed to this public app.
  const feed=window.OHISAMA_MENU_FEED||{};
  const source=feed.url||'';
  const sheetId=feed.sheetId||'';
  const shell=document.querySelector('.feature-shell'),quantity=document.getElementById('quantityPanel');
  const menu=document.getElementById('menuPanel'),quantityTab=document.getElementById('quantityTab'),menuTab=document.getElementById('menuTab');
  const categories=document.getElementById('menuCategories'),controls=document.getElementById('menuControls');
  const query=document.getElementById('menuQuery'),sort=document.getElementById('menuSort');
  const status=document.getElementById('menuStatus'),results=document.getElementById('menuResults'),detail=document.getElementById('menuDetail');
  let index=null,signature='',pending=null,category='',selected=null;
  const dateLabel=s=>`${Number(s.slice(0,4))}年${Number(s.slice(5,7))}月${Number(s.slice(8,10))}日`;
  function button(label,className,action){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.addEventListener('click',action);return b;}
  function setStatus(value){status.textContent=value;}
  function showTab(which){
    const active=which==='menu';shell.dataset.feature=which;
    quantity.hidden=active;quantity.classList.toggle('hidden',active);menu.hidden=!active;menu.classList.toggle('hidden',!active);
    quantityTab.setAttribute('aria-selected',String(!active));menuTab.setAttribute('aria-selected',String(active));
    if(active){refresh().catch(()=>{});render();}
  }
  function loadPublished(sig){
    if(!source||!sheetId)return Promise.reject(new Error('献立データの接続が未設定です'));
    return new Promise((resolve,reject)=>{
      const callback='__ohisamaMenuReceive',old=window[callback];let done=false;
      const script=document.createElement('script');
      const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);script.remove();if(old===undefined)delete window[callback];else window[callback]=old;err?reject(err):resolve(data);};
      const timer=setTimeout(()=>finish(new Error('通信がタイムアウトしました')),15000);
      window[callback]=response=>finish(null,response);
      script.onerror=()=>finish(new Error('献立データを取得できませんでした'));
      const tx=['out:json',`responseHandler:${callback}`];if(sig)tx.push(`sig:${sig}`);
      script.src=`${source}?gid=${sheetId}&headers=1&tqx=${encodeURIComponent(tx.join(';'))}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }
  async function refresh(){
    if(pending)return pending;
    if(!index)setStatus('献立データを確認中…');
    pending=(async()=>{
      try{
        const response=await loadPublished(signature);
        if(response.status==='error'&&response.errors?.some(x=>x.reason==='not_modified'))return;
        const rows=core.gvizRows(response);index=core.build(rows);signature=response.sig||'';
        render();
      }catch(error){setStatus(index?'最新データを確認できません。前回取得した結果を表示しています':'献立データを取得できませんでした。量計算はそのまま使えます');}
      finally{pending=null;}
    })();
    return pending;
  }
  function render(){
    if(!category){if(index)setStatus('カテゴリーを選んでください');return;}
    if(!index)return;
    if(selected){renderDetail();return;}
    results.classList.remove('hidden');
    const found=core.search(index,category,query.value,sort.value);
    setStatus(`${found.length}件の料理`);results.replaceChildren();detail.classList.add('hidden');
    if(!found.length){setStatus('該当する料理はありません');return;}
    const fragment=document.createDocumentFragment();
    for(const dish of found){
      const b=button('','menu-result',()=>{selected=dish.key;renderDetail();});
      const name=document.createElement('strong');name.textContent=dish.name;
      const meta=document.createElement('small');meta.textContent=`${dish.dates.length}回\n${dateLabel(dish.dates[0])}`;
      b.append(name,meta);fragment.append(b);
    }
    results.append(fragment);
  }
  function renderDetail(){
    const dish=index?.dishes.find(x=>x.key===selected);
    if(!dish){selected=null;render();return;}
    results.classList.add('hidden');detail.classList.remove('hidden');detail.replaceChildren();
    detail.append(button('‹ 検索結果へ戻る','menu-back',()=>{selected=null;results.classList.remove('hidden');render();}));
    const title=document.createElement('h3');title.textContent=dish.name;detail.append(title);
    const dates=document.createElement('div');dates.className='menu-dates';detail.append(dates);
    const day=document.createElement('div');day.className='menu-day';detail.append(day);
    function showDate(date){
      for(const b of dates.children)b.setAttribute('aria-pressed',String(b.dataset.date===date));
      day.replaceChildren();const h=document.createElement('strong');h.textContent=`${dateLabel(date)}の献立`;day.append(h);
      const ul=document.createElement('ul');for(const item of index.dates.get(date)||[]){const li=document.createElement('li'),label=document.createElement('span');label.textContent=`${item.category}　`;li.append(label,document.createTextNode(item.name));ul.append(li);}day.append(ul);
    }
    for(const date of dish.dates){const b=button(dateLabel(date),'menu-date',()=>showDate(date));b.dataset.date=date;dates.append(b);}
    if(dish.dates.length)showDate(dish.dates[0]);
    setStatus(`${dish.dates.length}回提供`);
  }
  for(const c of core.categories){const b=button(c,'menu-category',()=>{category=c;selected=null;results.classList.remove('hidden');controls.classList.remove('hidden');for(const item of categories.children)item.setAttribute('aria-pressed',String(item===b));render();});b.setAttribute('aria-pressed','false');categories.append(b);}
  query.addEventListener('input',()=>{selected=null;results.classList.remove('hidden');render();});
  sort.addEventListener('change',()=>{selected=null;results.classList.remove('hidden');render();});
  quantityTab.addEventListener('click',()=>showTab('quantity'));
  menuTab.addEventListener('click',()=>showTab('menu'));
  const help=document.querySelector('#helpEditor .help-feature');
  if(help){
    const toggle=button('献立検索','help-feature-button menu-help-button',()=>{const open=copy.classList.toggle('hidden');toggle.setAttribute('aria-expanded',String(!open));});
    toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','menuHelpCopy');
    const copy=document.createElement('div');copy.id='menuHelpCopy';copy.className='menu-help-copy hidden';
    copy.textContent='青いタブでカテゴリーを選ぶと候補が出ます。料理名や括弧内の食材で絞り込み、料理を選ぶと提供日と同日の献立を確認できます。';
    help.append(toggle,copy);
  }
})();
