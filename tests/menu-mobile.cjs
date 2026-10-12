const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
const contentType=file=>file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'text/html; charset=utf-8';
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,body)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',contentType(file));res.end(body);});});
const row=(y,m,d,category,name,order)=>[y,m,d,category,name,order];
const original=[
 row(2026,9,7,'サラダ','コーンのサラダ（きゅうり・赤玉ねぎ）',1),
 row(2026,9,7,'おやつ（1・2歳）','梅酢人参／みそ汁／焼きおにぎり',2),
 row(2026,9,7,'おやつ（3～5歳）','梅酢人参／焼きおにぎり',3),
 row(2026,9,8,'サラダ','コーンのサラダ（きゅうり・赤玉ねぎ）',1),
 row(2026,9,8,'煮物','じゃが煮（人参・玉ネギ）',2),
 row(2026,9,9,'煮物','じゃが煮（人参・玉ネギ・絹さや）',2),
 row(2026,9,10,'煮物','じゃが煮（糸こんにゃく）',2),
 row(2025,10,8,'おやつ','蒸しパン',1),
 row(2025,10,10,'おやつ','さつまいも蒸しパン',1),
 row(2025,10,10,'ご飯','だし粉ご飯',2),
 row(2025,10,10,'汁物','みそ汁（大根）',3),
 row(2025,10,10,'メイン','豆腐の磯辺焼き',4),
 row(2025,10,10,'煮物','大根と人参の煮物',5),
 row(2025,10,10,'サラダ','きゅうりのサラダ',6),
 row(2025,10,14,'おやつ','プリン',1)
];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 try{
  for(const width of [320,375,430,768]){
   let version='v1',requests=0,fail=false;
   const context=await browser.newContext({viewport:{width,height:800},deviceScaleFactor:1,timezoneId:'Asia/Tokyo'});const page=await context.newPage();
   await page.clock.setFixedTime(new Date('2026-10-11T15:30:00Z'));
   await page.addInitScript(()=>{window.OHISAMA_MENU_FEED={url:'https://example.invalid/menu.csv'};});
   await page.route('**/menu.csv',route=>{
    requests++;if(fail)return route.abort();
    const rows=version==='v1'?original:original.map(r=>r[0]===2026&&r[1]===9&&r[2]===8&&r[3]==='サラダ'?row(2026,9,8,'サラダ','修正したコーンのサラダ（きゅうり・赤玉ねぎ）',1):r);
    const body=['年度,月,日,区分,料理名,記載順',...rows.map(r=>r.join(','))].join('\n');
    route.fulfill({status:200,headers:{'access-control-allow-origin':'*','cache-control':'private, max-age=300'},contentType:'text/csv',body});
   });
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   assert.equal(requests,0,'量計算中は献立を取得しない');
   assert.equal(await page.locator('.menu-year-trigger').evaluate(e=>e.classList.contains('hidden')),true,'取得前は前年ボタンを隠す');
   const count=await page.locator('#allMealCount').innerText();
   await page.getByRole('tab',{name:'献立検索'}).click();
   const sortLabel=()=>page.locator('.menu-controls .soft-select-button').innerText();
   assert.equal(await sortLabel(),'新しい順','初回の並び替え表示');
   await page.locator('#menuQuery').fill('じゃがいも');
   await page.getByRole('status').getByText('2件の料理').waitFor();
   await page.locator('#menuQuery').fill('');
   await page.getByRole('button',{name:'サラダ',exact:true}).click();
   await page.getByRole('status').getByText('2件の料理').waitFor();
   await page.locator('#menuQuery').fill('赤玉ねぎ');
   await page.getByRole('button',{name:/コーンのサラダ/}).click();
   assert.equal(await page.locator('#menuResults').evaluate(e=>getComputedStyle(e).display),'none','詳細では結果一覧を隠す');
   assert.equal(await page.locator('.menu-date option').count(),2);
   assert.match(await page.locator('#menuDetail').innerText(),/2回提供|2026年9月8日/);
   await page.locator('.menu-date').selectOption('2026-09-07');
   assert.match(await page.locator('.menu-day').innerText(),/焼きおにぎり/);
   await page.getByRole('button',{name:/検索結果へ戻る/}).click();
   await page.getByRole('button',{name:/コーンのサラダ/}).click();
   await page.getByRole('button',{name:/検索結果へ戻る/}).click();
   await page.getByRole('button',{name:'サラダ',exact:true}).click();
   await page.locator('#menuQuery').fill('じゃがいも');
   await page.getByRole('button',{name:/じゃが煮.*2回/}).click();
   assert.equal(await page.locator('#menuDetail h3').innerText(),'じゃが煮');
   assert.equal(await page.locator('.menu-day strong').innerText(),'同日の献立');
   assert.deepEqual(await page.locator('.menu-day li').allTextContents(),['煮物　じゃが煮（人参・玉ネギ・絹さや）']);
   await page.locator('.menu-date').selectOption('2026-09-08');
   assert.deepEqual(await page.locator('.menu-day li').allTextContents(),[
    'サラダ　コーンのサラダ（きゅうり・赤玉ねぎ）','煮物　じゃが煮（人参・玉ネギ）'
   ]);
   assert.match(await page.locator('.menu-day').innerText(),/コーンのサラダ/);
   await page.getByRole('tab',{name:'量計算'}).click();
   await page.getByRole('tab',{name:'献立検索'}).click();
   assert.equal(await page.locator('.menu-date').inputValue(),'2026-09-08','更新確認後も選択日を維持');
   await page.screenshot({path:path.join(out,`menu-detail-${width}.png`),fullPage:true});
   await page.getByRole('button',{name:/検索結果へ戻る/}).click();
   assert.equal(await page.locator('#menuQuery').inputValue(),'じゃがいも');
   assert.equal(await sortLabel(),'新しい順');
   assert.equal(await page.getByRole('button',{name:'前年同時期'}).isVisible(),false);
   for(const category of ['サラダ','煮物','メイン','汁物','ご飯','おやつ']){
    await page.getByRole('button',{name:category,exact:true}).click();
    await page.getByRole('button',{name:'前年同時期'}).click();
    assert.equal(await page.locator('#menuControls').isVisible(),false,'前年一覧では通常検索欄を隠す');
    if(category==='おやつ')assert.match(await page.locator('#menuStatus').innerText(),/2025\/10\/12以前の直近：10\/10/);
    assert.match(await page.locator('#menuYear').innerText(),new RegExp(`前年同時期｜${category}`));
    assert.ok(await page.locator('#menuYear .menu-year-row').count()>0,`${category}に前年実績`);
    if(category==='おやつ'){
     assert.deepEqual(await page.locator('#menuYear .menu-year-row time').allTextContents(),['2025/10/14','2025/10/10','2025/10/8']);
     assert.equal(await page.locator('#menuYear .menu-year-anchor time').innerText(),'2025/10/10','前年同日が空なら直前日');
     await page.screenshot({path:path.join(out,`menu-year-${width}.png`),fullPage:true});
     await page.getByRole('button',{name:/2025\/10\/10.*さつまいも蒸しパン/}).click();
     assert.equal(await page.locator('#menuControls').isVisible(),false);
     assert.equal(await page.locator('#menuDetail h3').innerText(),'さつまいも蒸しパン');
     assert.equal(await page.locator('.menu-date').inputValue(),'2025-10-10');
     assert.equal(await page.locator('.menu-day strong').innerText(),'同日の献立');
     assert.deepEqual((await page.locator('.menu-day li span').allTextContents()).map(s=>s.trim()),
      ['サラダ','煮物','メイン','汁物','ご飯','おやつ']);
     assert.equal(await page.locator('.menu-day li').last().innerText(),'おやつ　さつまいも蒸しパン');
     await page.screenshot({path:path.join(out,`menu-seasonal-detail-${width}.png`),fullPage:true});
     await page.getByRole('button',{name:/前年同時期へ戻る/}).click();
     assert.equal(await page.locator('#menuYear .menu-year-row').count(),3);
    }
    await page.getByRole('button',{name:/検索結果へ戻る/}).click();
    assert.equal(await page.locator('#menuControls').isVisible(),true);
    assert.equal(await page.locator('#menuQuery').inputValue(),'じゃがいも');
    assert.equal(await sortLabel(),'新しい順');
    await page.getByRole('button',{name:category,exact:true}).click();
   }
   for(const [value,label] of [['new','新しい順'],['old','古い順'],['count','多い順'],['few','少ない順']]){
    await page.locator('#menuSort').selectOption(value);
    await page.getByRole('button',{name:/じゃが煮.*2回/}).click();
    await page.getByRole('button',{name:/検索結果へ戻る/}).click();
    assert.equal(await page.locator('#menuQuery').inputValue(),'じゃがいも');
    assert.equal(await sortLabel(),label,`${label}を詳細から戻っても維持`);
   }
   await page.locator('#menuSort').selectOption('few');
   assert.equal(await sortLabel(),'少ない順');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ohisama-menu-sort')),'few');
   await page.locator('#menuSort').selectOption('old');
   assert.equal(await sortLabel(),'古い順');
   await page.locator('#menuSort').selectOption('count');
   assert.equal(await sortLabel(),'多い順');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ohisama-menu-date-direction')),'old');
   await page.locator('#menuSort').selectOption('few');
   assert.equal(await sortLabel(),'少ない順');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ohisama-menu-date-direction')),'old');
   const controlHeights=await page.evaluate(()=>[document.getElementById('menuQuery'),document.querySelector('.menu-controls .soft-select-button')].map(e=>e.getBoundingClientRect().height));
   assert.deepEqual(controlHeights,[40,40],`${width}px input/select height`);
   await page.screenshot({path:path.join(out,`menu-${width}.png`),fullPage:true});
   const overflow=await page.evaluate(()=>[...document.querySelectorAll('#menuPanel button,#menuPanel input,#menuPanel select')].filter(e=>{if(e.closest('.hidden'))return false;const b=e.getBoundingClientRect();return b.width&&b.height&&(b.left< -2||b.right>innerWidth+2);}).map(e=>e.textContent||e.id));
   assert.deepEqual(overflow,[],`${width}px menu overflow`);
   await page.reload();
   assert.equal(await page.getByRole('tab',{name:'献立検索'}).getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('#menuSort').inputValue(),'few');
   assert.equal(await sortLabel(),'少ない順','再読込後の見える並び替え表示');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ohisama-menu-date-direction')),'old');
   await page.getByRole('tab',{name:'量計算'}).click();
   assert.equal(await page.locator('#allMealCount').innerText(),count);
   await page.reload();
   assert.equal(await page.getByRole('tab',{name:'量計算'}).getAttribute('aria-selected'),'true');
   await page.getByRole('tab',{name:'献立検索'}).click();
   await page.getByRole('status').getByText(/カテゴリーを選ぶか/).waitFor();
   assert.equal(requests,4,'検索タブ再訪時だけ更新を確認する');
   await page.evaluate(()=>localStorage.setItem('ohisama-active-feature-tab','removedTab'));
   await page.reload();
   assert.equal(await page.getByRole('tab',{name:'量計算'}).getAttribute('aria-selected'),'true');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ohisama-active-feature-tab')),'quantityTab');
   await page.getByRole('tab',{name:'献立検索'}).click();
   version='v2';await page.getByRole('tab',{name:'量計算'}).click();await page.getByRole('tab',{name:'献立検索'}).click();
   await page.locator('#menuQuery').fill('修正した');
   await page.getByRole('button',{name:/修正したコーンのサラダ/}).waitFor();
   assert.equal(requests,6,'古い提供日を保持した訂正にも更新を検知する');
   fail=true;await page.getByRole('tab',{name:'量計算'}).click();await page.getByRole('tab',{name:'献立検索'}).click();
   await page.getByRole('status').getByText(/最新データを確認できません/).waitFor();
   await page.getByRole('tab',{name:'量計算'}).click();assert.equal(await page.locator('#allMealCount').innerText(),count);
   assert.ok(requests>=5);await context.close();
  }
  console.log('menu browser: 320/375/430/768, refresh and calculator isolation OK');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
