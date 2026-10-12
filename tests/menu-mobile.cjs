const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
const contentType=file=>file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'text/html; charset=utf-8';
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,body)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',contentType(file));res.end(body);});});
const row=(y,m,d,category,name,order)=>[y,m,d,category,name,order];
const original=[row(2026,9,7,'サラダ','コーンのサラダ（きゅうり・赤玉ねぎ）',1),row(2026,9,7,'おやつ（1・2歳）','梅酢人参／みそ汁／焼きおにぎり',2),row(2026,9,7,'おやつ（3・4・5歳）','梅酢人参／焼きおにぎり',3),row(2026,9,8,'サラダ','コーンのサラダ（きゅうり・赤玉ねぎ）',1)];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 try{
  for(const width of [320,375,430,768]){
   let version='v1',requests=0,fail=false;
   const context=await browser.newContext({viewport:{width,height:800},deviceScaleFactor:1});const page=await context.newPage();
   await page.addInitScript(()=>{window.OHISAMA_MENU_FEED={url:'https://example.invalid/menu.csv'};});
   await page.route('**/menu.csv',route=>{
    requests++;if(fail)return route.abort();
    const rows=version==='v1'?original:[...original,row(2026,9,10,'メイン','新しい豆腐料理',1)];
    const body=['年度,月,日,区分,料理名,記載順',...rows.map(r=>r.join(','))].join('\n');
    route.fulfill({status:200,headers:{'access-control-allow-origin':'*','cache-control':'private, max-age=300'},contentType:'text/csv',body});
   });
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   assert.equal(requests,0,'量計算中は献立を取得しない');
   const count=await page.locator('#allMealCount').innerText();
   await page.getByRole('tab',{name:'献立検索'}).click();
   await page.getByRole('button',{name:'サラダ',exact:true}).click();
   await page.getByRole('status').getByText('1件の料理').waitFor();
   await page.locator('#menuQuery').fill('赤玉ねぎ');
   await page.getByRole('button',{name:/コーンのサラダ/}).click();
   assert.match(await page.locator('#menuDetail').innerText(),/2回提供|2026年9月7日/);
   await page.locator('.menu-date').nth(1).click();
   assert.match(await page.locator('.menu-day').innerText(),/梅酢人参/);
   await page.screenshot({path:path.join(out,`menu-${width}.png`),fullPage:true});
   const overflow=await page.evaluate(()=>[...document.querySelectorAll('#menuPanel button,#menuPanel input,#menuPanel select')].filter(e=>{if(e.closest('.hidden'))return false;const b=e.getBoundingClientRect();return b.width&&b.height&&(b.left< -2||b.right>innerWidth+2);}).map(e=>e.textContent||e.id));
   assert.deepEqual(overflow,[],`${width}px menu overflow`);
   await page.getByRole('tab',{name:'量計算'}).click();
   assert.equal(await page.locator('#allMealCount').innerText(),count);
   await page.getByRole('tab',{name:'献立検索'}).click();
   await page.getByRole('status').getByText('2回提供').waitFor();
   assert.equal(requests,2,'タブを開いた時だけ更新を確認する');
   version='v2';await page.getByRole('tab',{name:'量計算'}).click();await page.getByRole('tab',{name:'献立検索'}).click();
   await page.getByRole('button',{name:'メイン',exact:true}).click();
   await page.locator('#menuQuery').fill('');
   await page.getByRole('button',{name:/新しい豆腐料理/}).waitFor();
   assert.equal(requests,3,'古い提供日を保持した訂正にも更新を検知する');
   fail=true;await page.getByRole('tab',{name:'量計算'}).click();await page.getByRole('tab',{name:'献立検索'}).click();
   await page.getByRole('status').getByText(/最新データを確認できません/).waitFor();
   await page.getByRole('tab',{name:'量計算'}).click();assert.equal(await page.locator('#allMealCount').innerText(),count);
   assert.ok(requests>=4);await context.close();
  }
  console.log('menu browser: 320/375/430/768, refresh and calculator isolation OK');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
