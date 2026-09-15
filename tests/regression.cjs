// Run with jsdom installed: NODE_PATH=/path/to/node_modules node tests/regression.cjs
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
async function boot(seed={}){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(html,{url:'https://test.invalid/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){for(const [k,v]of Object.entries(seed))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));w.alert=()=>{};w.confirm=()=>true;}});
 await new Promise(r=>setTimeout(r,30));assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
 const w=dom.window;return {w,d:w.document,errors,close:()=>w.close(),ev:code=>w.eval(code),snapshot:()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)]}))};
}
function change(app,id,value){const e=app.d.getElementById(id);if(e.type==='checkbox')e.checked=value;else e.value=String(value);e.dispatchEvent(new app.w.Event(e.tagName==='INPUT'&&e.type!=='checkbox'?'input':'change',{bubbles:true}));}
(async()=>{
 let a=await boot();assert.equal(a.d.querySelectorAll('.feature-tab').length,1);assert.equal(a.d.getElementById('cutCalculator').classList.contains('hidden'),true);
 assert.equal(a.ev('dryFoods.find(f=>f.id==="hijiki").mealRate'),5);assert.equal(a.ev('dryFoods.find(f=>f.id==="kiriboshi_daikon").mealRate'),10);
 for(const id of ['somen','udon'])assert.equal(a.ev(`dryFoods.find(f=>f.id==='${id}').snackRate`),null);
 for(const id of ['c5','ca'])assert.equal(a.d.getElementById(id).lastElementChild.value,'other');
 for(const id of ['c0','c1','c2','c3','c4','cg'])assert.equal([...a.d.getElementById(id).options].some(o=>o.value==='other'),false);
 change(a,'c5','other');change(a,'c5Other',14);change(a,'ca','other');change(a,'caOther',20);
 assert.equal(a.ev('counts().c5'),14);assert.equal(a.ev('counts().ca'),20);assert.equal(a.ev('maxCounts.c5'),6);
 const n=a.ev('dryInitialPeople()');assert.equal(Number(a.d.getElementById('allMealCount').textContent),n+a.ev('counts().c0'));
 const expectedCut=a.ev('counts().c1+counts().c2+2*(counts().c3+counts().c4+counts().c5)+3*counts().ca');assert.equal(a.ev('cutTotalFor(cutSlots[0])'),expectedCut);
 change(a,'dryFood','hijiki');assert.equal(a.d.getElementById('dryResultValue').textContent,n*5+'g');assert.equal(a.d.getElementById('dryPeople').readOnly,true);
 const riceBefore=a.d.getElementById('riceAmount').textContent;
 change(a,'cgEats',true);assert.equal(a.ev('cutPeople()[5]'),a.ev('counts().cg'));assert.equal(a.d.getElementById('dryResultValue').textContent,a.ev('dryInitialPeople()*5')+'g');assert.notEqual(a.d.getElementById('riceAmount').textContent,riceBefore);
 change(a,'cgEats',false);assert.equal(a.ev('counts().ca'),20);assert.equal(a.ev('cutPeople()[5]'),0);
 change(a,'drySnack',true);assert.equal(a.d.getElementById('dryPeople').readOnly,false);change(a,'dryPeople',23);assert.equal(a.d.getElementById('dryResultNote').textContent,'1人量が未設定です');
 a.ev('dryFoods.find(f=>f.id==="hijiki").snackRate=2;saveDryFoods();updateDryResult()');assert.equal(a.d.getElementById('dryResultValue').textContent,'46g');
 const saved=a.snapshot();a.close();a=await boot(saved);assert.equal(a.ev('counts().c5'),14);assert.equal(a.ev('counts().ca'),20);assert.equal(a.d.getElementById('c5Other').classList.contains('hidden'),false);assert.equal(a.d.getElementById('drySnack').checked,true);assert.equal(a.d.getElementById('dryResultValue').textContent,'46g');
 change(a,'c5',5);assert.equal(a.d.getElementById('c5Other').classList.contains('hidden'),true);change(a,'drySnack',false);change(a,'dryFood','kiriboshi_daikon');assert.equal(a.d.getElementById('dryResultValue').textContent,a.ev('dryInitialPeople()*10')+'g');a.d.getElementById('dryMealChoices').children[1].click();assert.equal(a.d.getElementById('dryResultValue').textContent,a.ev('dryInitialPeople()*8')+'g');change(a,'drySnack',true);assert.equal(a.d.getElementById('dryResultNote').textContent,'1人量が未設定です');
 a.d.querySelector('[aria-controls="cutCalculator"]').click();a.d.querySelector('#cutRates button').click();a.d.querySelector('#cutAges button').click();assert.equal(a.ev('cutTotalFor(cutSlots[0])'),a.ev('dryInitialPeople()'));
 a.d.querySelectorAll('#cutRates button')[3].click();a.d.querySelectorAll('#cutAges button')[6].click();assert.equal(a.ev('cutSlots[0].rates[6]'),4);change(a,'cutMemo','なす');change(a,'cutYield',8);assert.equal(a.d.getElementById('cutPack').textContent,`必要 ${Math.ceil(a.ev('cutTotalFor(cutSlots[0])')/8)}個分`);a.d.querySelectorAll('#cutSlots button')[1].click();assert.equal(a.ev('cutSlots[0].memo'),'なす');assert.equal(a.d.getElementById('cutMemo').value,'');
 a.d.querySelector('[aria-controls="dryCalculator"]').click();assert.equal(a.d.getElementById('cutCalculator').classList.contains('hidden'),true);
 // The explicit 51 slices / 8 per item example rounds up to 7 items.
 a.ev('cutSlot=0;cutSlots[0]=emptyCut();["c1","c2","c3","c4","c5","cg"].forEach(id=>setCountSelectValue(id,0));setCountSelectValue("c1",5);setCountSelectValue("c3",2);setCountSelectValue("ca",14);update()');
 change(a,'cutYield',8);assert.equal(a.ev('cutTotalFor(cutSlots[0])'),51);assert.equal(a.d.getElementById('cutPack').textContent,'必要 7個分');
 // Main food calculation, remainder, rice and porridge independently checked.
 a.ev('resetCurrentCounts();selectFoodCandidate("chicken")');const units=a.ev('counts().c1+counts().c2+2*(counts().c3+counts().c4+counts().c5)+3*counts().ca');assert.equal(Number(a.d.getElementById('resultNumber').textContent),Math.ceil(units/5));assert.ok(a.d.getElementById('subResult').textContent.includes('余り '+(Math.ceil(units/5)*5-units)));
 change(a,'porridgeEnabled',true);assert.equal(a.d.getElementById('riceAmount').textContent,a.ev('fmt(Math.ceil((Number(document.getElementById("allMealCount").textContent)-1)/3*2)/2)+"合"'));
 // All current help renderers execute and IDs remain unique.
 a.ev('renderHelpGuides()');await new Promise(r=>setTimeout(r,40));assert.equal(a.errors.length,0,a.errors.map(e=>e.message).join('\n'));const ids=[...a.d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(ids.length,new Set(ids).size);assert.ok(a.d.getElementById('helpCutLive').textContent.includes('その他'));assert.ok(a.d.getElementById('helpDryLive').textContent.includes('少なめ8g'));a.close();
 // Preserve explicit saved values, intentionally empty options, notes, nulls, and deleted foods.
 const custom={id:'chicken',name:'鶏もも',category:'meat',unit:'切れ',r0:null,r12:0,rm:9,rg:8,ra:7,usesCutting:false,packSize:5,packLabel:'枚',note:'0歳は食べない',optionTitle:'',variants:[]};
 a=await boot({kyushokuFoodsV6:[custom],kyushokuHokkeAddedV1:'1',kyushokuDryFoodsV1:[{id:'hijiki',name:'ひじき',unit:'g',mealRate:null,snackRate:0}]});
 const actual=JSON.parse(a.w.localStorage.getItem('kyushokuFoodsV6')).find(f=>f.id==='chicken');for(const key of Object.keys(custom))assert.deepEqual(actual[key],custom[key],key);
 assert.equal(a.ev('dryFoods.length'),1);assert.equal(a.ev('dryFoods[0].mealRate'),null);assert.equal(a.ev('dryFoods[0].snackRate'),0);
 assert.equal(a.ev('foods.some(f=>f.id==="teba"||f.id==="sasami"||f.id==="buri")'),false);
 a.ev('editingDryFoodId="hijiki";deleteDryFood()');const deleted=a.snapshot();a.close();a=await boot(deleted);assert.equal(a.ev('dryFoods.length'),0);
 // Missing properties/new IDs merge once; deleted IDs do not resurrect; explicit nulls survive.
 assert.equal(a.ev(`JSON.stringify(mergeCatalogDefaults([{id:'a',v:null,nested:{x:0}}],[{id:'a',v:10,nested:{x:2,y:3}},{id:'b',v:5}],'testCatalog',['a']))`),JSON.stringify([{id:'a',v:null,nested:{x:0,y:3}},{id:'b',v:5}]));
 assert.equal(a.ev(`mergeCatalogDefaults([{id:'a',v:7}],[{id:'a',v:10},{id:'b',v:5}],'testCatalog',['a']).length`),1);a.close();
 a=await boot({kyushokuFoodsV6:[],kyushokuDryFoodsV1:[]});assert.equal(a.ev('foods.length'),0);assert.equal(a.ev('dryFoods.length'),0);change(a,'ca','other');change(a,'caOther',20);assert.ok(Number(a.d.getElementById('allMealCount').textContent)>20);a.close();
 console.log('PASS: counts, restoration, rice, porridge, school meals, main/remainders, dry modes, cut slots, help structure, saved-value preservation and catalog migration');
})().catch(e=>{console.error(e);process.exit(1)});
