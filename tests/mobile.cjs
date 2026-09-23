// CI-only regression test: a disposable browser, synthetic counts, no production storage.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'test-results');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(data);});
});
async function select(page,id,text){
  await page.locator(`#${id}`).locator('..').locator('.soft-select-button').click();
  await page.locator('.soft-select-popover').getByRole('option',{name:text,exact:true}).click();
}
async function noOverflow(page,label){
  const details=await page.evaluate(()=>{
    const vw=innerWidth;
    return [...document.querySelectorAll('#quantityPanel input,#quantityPanel button,#helpEditor .help-caption,#helpEditor .help-target-number,#helpEditor .help-live-clone')].filter(e=>{
      const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>vw+2||r.left< -2)&&!e.closest('.hidden')&&!e.classList.contains('soft-select-native');
    }).map(e=>({tag:e.tagName,text:(e.innerText||e.id).slice(0,70),rect:e.getBoundingClientRect().toJSON()}));
  });
  assert.deepEqual(details,[],label+' horizontal overflow');
  const clipped=await page.locator('#helpEditor .help-live-clone').evaluateAll(clones=>clones.flatMap(clone=>{
    if(clone.closest('.hidden'))return [];
    const bounds=clone.getBoundingClientRect();
    return [...clone.querySelectorAll('button,input,.sub,.category-chip,.variant-choice')].filter(e=>{
      const r=e.getBoundingClientRect();return r.width&&r.height&&!e.closest('.hidden')&&(r.right>bounds.right+3||r.left<bounds.left-3);
    }).map(e=>({text:(e.innerText||e.id).slice(0,70),rect:e.getBoundingClientRect().toJSON()}));
  }));
  assert.deepEqual(clipped,[],label+' controls clipped within help card');
  const cramped=await page.locator('#helpEditor .help-live-clone .snack-person').evaluateAll(items=>items.flatMap(item=>{
    if(item.closest('.hidden'))return [];
    const bounds=item.getBoundingClientRect();
    return [...item.querySelectorAll('button,strong')].filter(e=>{
      const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>bounds.right+2||r.left<bounds.left-2);
    }).map(e=>({text:(e.innerText||e.id).slice(0,30),rect:e.getBoundingClientRect().toJSON(),parent:bounds.toJSON()}));
  }));
  assert.deepEqual(cramped,[],label+' snack controls clipped within help person card');
}
async function tapCutCell(page,rowIndex,cellNumber){
  await page.locator('#cutAges .pieces-scroll').nth(rowIndex).evaluate((el,n)=>{const cell=el.querySelector(`.piece-cell:nth-child(${n})`),r=cell.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:41,button:0,clientX:x,clientY:y}));el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:41,button:0,clientX:x,clientY:y}))},cellNumber);
}
async function tapFractionStep(page,rowIndex,stepIndex){
  await page.locator('#cutAges .fraction-control').nth(rowIndex).evaluate((el,step)=>{const r=el.querySelector('.fraction-track').getBoundingClientRect(),x=r.left+r.width*step/7,y=r.top+r.height/2;el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:42,button:0,clientX:x,clientY:y}));el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:42,button:0,clientX:x,clientY:y}))},stepIndex);
}
async function dragPiecesPastEdge(page,rowIndex){
  await page.locator('#cutAges .pieces-scroll').nth(rowIndex).evaluate(async el=>{const r=el.getBoundingClientRect(),y=r.top+r.height/2;el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:43,button:0,clientX:r.left+20,clientY:y}));el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:43,button:0,clientX:r.right+12,clientY:y}));await new Promise(resolve=>setTimeout(resolve,380));el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:43,button:0,clientX:r.right+12,clientY:y}))});
}
async function verticalGesture(page,rowIndex){
  await page.locator('#cutAges .fraction-control').nth(rowIndex).evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:44,button:0,clientX:x,clientY:y}));el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:44,button:0,clientX:x+2,clientY:y+35}));el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:44,button:0,clientX:x+2,clientY:y+35}))});
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{});
  const report=[];
  try{
    for(const width of [320,375,768]){
      const context=await browser.newContext({viewport:{width,height:width===320?568:900},deviceScaleFactor:1,hasTouch:true});
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      try{
        await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.evaluate(()=>document.fonts.ready);
        await page.screenshot({path:path.join(out,`${width}-initial.png`),fullPage:true});
        await noOverflow(page,'initial '+width);
        assert.ok(await page.locator('.header-logo-image').evaluate(e=>e.complete&&e.naturalWidth===2172));
        assert.equal(await page.locator('#c5Other').isVisible(),false);
        await select(page,'c5','その他');await page.locator('#c5Other').fill('14');
        await select(page,'ca','その他');await page.locator('#caOther').fill('20');
        await page.reload();assert.equal(await page.locator('#c5Other').inputValue(),'14');assert.equal(await page.locator('#caOther').inputValue(),'20');
        await page.locator('[aria-controls="cutCalculator"]').click();
        await page.locator('#cutSlots button').nth(2).click();
        await page.locator('#cutAges .cut-age-select').nth(2).click();await page.locator('#cutAges .cut-age-select').nth(3).click();await page.locator('#cutAges .cut-age-select').nth(4).click();
        await tapCutCell(page,2,3);assert.deepEqual(await page.evaluate(()=>cutSlots[2].rates.slice(2,5)),[3,3,3]);assert.equal(await page.locator('#cutSelectionClear').isDisabled(),true);
        await tapCutCell(page,2,2);await tapCutCell(page,3,2);await tapCutCell(page,4,2);await tapCutCell(page,6,3);
        const total=await page.evaluate(()=>cutTotalFor(cutSlots[2]));
        assert.equal(total,await page.evaluate(()=>counts().c1+counts().c2+2*(counts().c3+counts().c4+counts().c5)+3*counts().ca));
        await dragPiecesPastEdge(page,0);assert.ok(await page.evaluate(()=>cutSlots[2].rates[0]>5));assert.ok(await page.locator('#cutAges .pieces-scroll').first().getAttribute('aria-valuemax').then(Number)>5);
        await tapCutCell(page,0,1);
        await page.locator('.cut-options summary').click();await page.locator('#cutMemo').fill('なす');await page.locator('#cutYield').fill('8');
        assert.equal(await page.locator('#cutPack').innerText(),`必要 ${Math.ceil(total/8)}個分`);
        await page.locator('#cutSlots button').nth(3).click();await page.locator('#cutMemo').fill('厚揚げ');
        await page.locator('#cutSlots button').nth(2).click();assert.equal(await page.locator('#cutMemo').inputValue(),'なす');
        await page.locator('.cut-calculator-card').screenshot({path:path.join(out,`${width}-cut.png`)});await noOverflow(page,'cut '+width);
        await page.locator('#cgEats').check();assert.equal(await page.evaluate(()=>cutPeople()[5]),await page.evaluate(()=>counts().cg));
        await page.locator('#cgEats').uncheck();assert.equal(await page.evaluate(()=>cutPeople()[5]),0);
        const lunchAdult=await page.evaluate(()=>counts().ca);
        await page.locator('#cutSlots button').nth(0).click();await page.locator('#cutContext [data-context="snack"]').click();
        assert.equal(await page.evaluate(()=>cutPeople()[5]),await page.evaluate(()=>counts().cg));
        await page.locator('#snackPeopleGrid .snack-person').nth(6).getByRole('button',{name:'＋'}).click();
        assert.equal(await page.evaluate(()=>counts().ca),lunchAdult);assert.equal(await page.evaluate(()=>cutPeople()[6]),lunchAdult+1);
        await page.locator('#cutAges .cut-age-select').nth(2).click();await page.locator('#cutAges .cut-age-select').nth(3).click();await page.locator('#cutAges .cut-age-select').nth(4).click();await tapFractionStep(page,2,3);
        assert.deepEqual(await page.evaluate(()=>cutSlots[0].rates.slice(2,5)),[5,5,5]);assert.equal(await page.locator('#cutSelectionClear').isDisabled(),true);
        const beforeVertical=await page.evaluate(()=>cutSlots[0].rates[0]);await verticalGesture(page,0);assert.equal(await page.evaluate(()=>cutSlots[0].rates[0]),beforeVertical);
        for(let step=1;step<8;step++){await tapFractionStep(page,0,step);assert.equal(await page.evaluate(()=>cutSlots[0].rates[0]),[0,8,6,5,4,3,2,1][step])}
        await tapFractionStep(page,0,3);
        assert.equal(await page.evaluate(()=>fractionPlan(cutSlots[0]).bins.every(bin=>bin.used<=FRACTION_BASE)),true);
        assert.ok((await page.locator('#fractionResult').innerText()).includes('用意する量'));
        assert.ok((await page.locator('#fractionResult').innerText()).includes('5等分：'));
        assert.ok(await page.locator('#fractionResult svg text').filter({hasText:'1/5'}).count());
        await page.locator('#fractionResult').getByRole('button',{name:'丸型'}).click();assert.ok(await page.locator('#fractionResult svg circle').count());
        await page.locator('.cut-calculator-card').screenshot({path:path.join(out,`${width}-fraction.png`)});await noOverflow(page,'fraction '+width);
        await page.locator('[aria-controls="dryCalculator"]').click();assert.equal(await page.locator('#cutCalculator').isVisible(),false);
        await select(page,'dryFood','ひじき');assert.equal(await page.locator('#dryResultValue').innerText(),(await page.evaluate(()=>dryInitialPeople()*5))+'g');
        await select(page,'dryFood','切り干し大根');await page.locator('#dryMealChoices').getByRole('button',{name:'少なめ 8g'}).click();
        assert.equal(await page.locator('#dryResultValue').innerText(),(await page.evaluate(()=>dryInitialPeople()*8))+'g');
        await page.locator('.dry-calculator-card').screenshot({path:path.join(out,`${width}-dry-meal.png`)});
        await page.locator('#drySnack').check();assert.equal(await page.locator('#dryPeople').isEditable(),false);assert.equal(Number(await page.locator('#dryPeople').inputValue()),await page.evaluate(()=>snackPeopleTotal()));assert.equal(await page.locator('#dryResultNote').innerText(),'1人量が未設定です');
        await page.locator('.dry-calculator-card').screenshot({path:path.join(out,`${width}-dry-snack.png`)});
        await page.locator('[aria-controls="foodEditor"]').click();assert.equal(await page.locator('#mainFoodEditor').isVisible(),false);assert.equal(await page.locator('#dryEditor').isVisible(),false);
        await page.locator('#foodEditorChooser [data-editor-kind="dry"]').click();
        await select(page,'dryEditFood','ひじき');await page.locator('#drySnackRate').fill('2');await page.locator('#dryEditor').getByRole('button',{name:'保存 / 更新'}).click();
        await page.locator('[aria-controls="dryCalculator"]').click();assert.equal(await page.locator('#dryResultValue').innerText(),(await page.evaluate(()=>snackPeopleTotal()*2))+'g');
        await page.locator('[aria-controls="dryCalculator"]').click();
        // The category tiles are covered by native selects on touch devices.
        // Select through the same control a user opens, rather than the desktop-only popup.
        await page.locator('#fishFoodsSelect').selectOption({label:'赤魚'});
        assert.equal(await page.locator('#currentFoodName').innerText(),'赤魚');assert.equal(await page.locator('#foodOptionChoices .variant-choice').count(),2);
        await page.locator('#foodOptionChoices .variant-choice').nth(0).click();assert.equal(Number(await page.locator('#resultNumber').innerText()),await page.evaluate(()=>counts().c1+counts().c2+counts().c3+counts().c4+counts().c5+counts().ca));
        await page.locator('#foodOptionChoices .variant-choice').nth(1).click();assert.equal(Number(await page.locator('#resultNumber').innerText()),await page.evaluate(()=>counts().c1+counts().c2+2*(counts().c3+counts().c4+counts().c5)+2*counts().ca));
        await select(page,'c5','5');assert.equal(await page.locator('#c5Other').isVisible(),false);
        await page.getByRole('button',{name:'基本人数に戻す',exact:true}).click();
        await page.locator('[aria-controls="foodEditor"]').click();
        await page.locator('#foodEditorChooser [data-editor-kind="dry"]').click();
        await page.locator('#dryEditor').getByRole('button',{name:'新規入力',exact:true}).click();
        await page.locator('#dryEditName').fill('検証用乾物');await page.locator('#dryMealRate').fill('3');
        await page.locator('#dryEditor').getByRole('button',{name:'保存 / 更新'}).click();
        assert.ok(await page.evaluate(()=>dryFoods.some(f=>f.name==='検証用乾物'&&f.mealRate===3&&f.snackRate===null)));
        await page.locator('#dryEditor').getByRole('button',{name:'選択中を削除'}).click();
        assert.equal(await page.evaluate(()=>dryFoods.some(f=>f.name==='検証用乾物')),false);
        await page.locator('#dryEditor .editor-mode-back').click();
        await page.locator('#foodEditorChooser [data-editor-kind="main"]').click();
        await noOverflow(page,'main editor '+width);
        await page.locator('.food-editor-card').screenshot({path:path.join(out,`${width}-main-editor.png`)});
        await page.locator('#mainFoodEditor').getByRole('button',{name:'新規入力',exact:true}).click();
        await page.locator('#editCategoryChoices [data-category="meat"]').click();await page.locator('#editName').fill('検証用食材');
        await select(page,'editUnitChoice','g');for(const id of ['r12','rm','rg','ra'])await select(page,id+'Choice','1');
        await page.locator('#mainFoodEditor').getByRole('button',{name:'保存 / 更新'}).click();
        assert.ok(await page.evaluate(()=>foods.some(f=>f.name==='検証用食材'&&f.r12===1)));
        await page.locator('#mainFoodEditor').getByRole('button',{name:'選択中を削除'}).click();
        assert.equal(await page.evaluate(()=>foods.some(f=>f.name==='検証用食材')),false);
        await page.locator('[aria-controls="foodEditor"]').click();
        await page.locator('#porridgeEnabled').check();
        await page.locator('[aria-controls="defaultsEditor"]').click();
        await page.locator('#m5').fill('7');await page.getByRole('button',{name:'最大人数を保存',exact:true}).click();
        await page.locator('#d5').fill('6');await page.getByRole('button',{name:'基本人数を保存',exact:true}).click();
        await page.reload();assert.equal(await page.evaluate(()=>counts().c5),6);
        await page.locator('[aria-controls="defaultsEditor"]').click();
        await noOverflow(page,'defaults '+width);
        await page.locator('#d5').fill('5');await page.getByRole('button',{name:'基本人数を保存',exact:true}).click();
        await page.locator('#m5').fill('6');await page.getByRole('button',{name:'最大人数を保存',exact:true}).click();
        await page.locator('[aria-controls="defaultsEditor"]').click();
        await page.locator('#porridgeEnabled').check();
        await page.locator('.global-help-button').click();
        const locked=await page.evaluate(()=>({body:document.body.classList.contains('help-open'),modal:document.getElementById('helpEditor').getAttribute('aria-modal'),top:document.body.style.top}));assert.equal(locked.body,true);assert.equal(locked.modal,'true');assert.ok(locked.top.endsWith('px'));
        for(const topic of ['helpDaily','helpCut','helpDry','helpPeople','helpFoods']){
          await page.locator(`[aria-controls="${topic}"]`).click();
          await page.locator(`#${topic} .help-live-clone`).first().waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
          await noOverflow(page,topic+' '+width);
          // Expand only the scroll viewport for a complete artifact; geometry checks above use the real panel.
          const captureStyle=await page.addStyleTag({content:'body.help-open{position:static!important;top:auto!important}.app-header,.global-help{position:static!important}#helpEditor{position:absolute!important;top:0!important;max-height:none!important;overflow:visible!important}.global-help-header{position:static!important}'});
          const cards=page.locator(`#${topic} .guide-step`).filter({visible:true});
          const count=await cards.count();
          for(let i=0;i<count;i++)await cards.nth(i).screenshot({path:path.join(out,`${width}-${topic}-${i}.png`)});
          await captureStyle.evaluate(element=>element.remove());
        }
        await page.locator('.global-help-close').click();assert.equal(await page.evaluate(()=>document.body.classList.contains('help-open')),false);
        assert.deepEqual(errors,[]);report.push({width,status:'passed'});
      }catch(error){report.push({width,status:'failed',error:error.stack,errors});await page.screenshot({path:path.join(out,`${width}-failure.png`),fullPage:true});throw error;}
      finally{await context.close();}
    }
  }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
