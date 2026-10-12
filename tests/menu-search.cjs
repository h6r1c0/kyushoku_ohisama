const assert=require('node:assert/strict');
const menu=require('../menu-search-core.js');
const fs=require('node:fs'),path=require('node:path');
assert.match(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),/<script src="menu-search-config\.js"><\/script>\s*<script src="menu-search\.js"><\/script>/);
const rows=[
  [2026,9,6,'サラダ','古い野菜サラダ',1],
  [2026,9,7,'サラダ','コーンのサラダ（きゅうり・赤玉ねぎ）',1],
  [2026,9,7,'主菜','豆腐ハンバーグ',2],
  [2026,9,7,'おやつ（1・2歳）','梅酢人参／みそ汁／焼きおにぎり',3],
  [2026,9,7,'おやつ（3～5歳）','梅酢人参／焼きおにぎり',4],
  [2026,9,8,'サラダ・和え物','コーンのサラダ（きゅうり・赤玉ねぎ）',1],
  [2026,9,8,'おやつ','梅酢人参',2],
  [2026,9,8,'果物','日向夏',3],
  [2026,9,9,'休園','給食なし',1],
  [2026,9,10,'ご飯・主食','おむすび',1],
  [2026,9,10,'行事食（主食・汁物一体）','天の川素麺（星人参）',2],
  [2026,9,10,'煮物','大根と人参の煮物',3],
  [2026,9,11,'煮物','大根・人参・こんにゃくの煮物',1],
  [2026,9,11,'煮物','じゃが煮（玉ネギ・人参・絹さや）',2],
  [2026,9,12,'煮物','じゃが煮（いんげん）',1],
  [2026,9,13,'煮物','じゃが煮（人参・玉ねぎ・糸こんにゃく）',1],
  [2026,9,14,'煮物','ごろっとじゃが煮（玉ねぎ・人参）',1],
  [2026,9,14,'サラダ','かぼちゃサラダ（レタス・豆乳マヨ）',2],
  [2026,9,14,'汁物','みそ汁（大根・なめこ）',3],
  [2026,9,15,'汁物','冷やしみそ汁',1],
  [2026,9,15,'おやつ','昆布またはブロッコリーの芯／柿ジャムの豆乳寒天',2]
];
const index=menu.build(rows);
assert.deepEqual(index.categories,['サラダ','煮物','メイン','汁物','ご飯','おやつ']);
assert.equal(menu.search(index,'サラダ','赤玉ねぎ').length,1);
assert.equal(menu.search(index,'サラダ','コーン')[0].dates.length,2);
assert.equal(menu.search(index,'メイン','豆腐')[0].dates[0],'2026-09-07');
assert.equal(menu.search(index,'おやつ','梅酢人参').length,0);
assert.equal(menu.search(index,'おやつ','焼きおにぎり')[0].dates.length,1);
assert.equal(menu.search(index,'おやつ','みそ汁').length,0);
assert.equal(menu.search(index,'ご飯','')[0].dates[0],'2026-09-10');
assert.equal(menu.search(index,'果物').length,0);
assert.equal(index.dates.get('2026-09-07').filter(x=>x.name==='梅酢人参').length,0);
assert.equal(menu.search(index,'サラダ','','old')[0].dates[0],'2026-09-06');
assert.equal(menu.search(index,'サラダ','','new')[0].dates[0],'2026-09-14');
assert.equal(menu.search(index,'煮物','','count')[0].name,'じゃが煮');
assert.equal(menu.search(index,'煮物','','few').at(0).dates.length,1);
assert.equal(menu.search(index,'','大根人参').length,2);
assert.equal(menu.search(index,'','じゃがいも').length,3);
assert.equal(menu.search(index,'煮物','玉ねぎ').some(x=>x.name==='じゃが煮'),true);
assert.equal(menu.search(index,'煮物','玉ネギ').some(x=>x.name==='じゃが煮'),true);
assert.equal(menu.search(index,'煮物','インゲン').some(x=>x.name==='じゃが煮'),true);
assert.equal(menu.search(index,'サラダ','豆乳マヨ')[0].display,'豆乳マヨ｜かぼちゃサラダ');
assert.ok(menu.search(index,'汁物','みそ汁').some(x=>x.display==='味噌汁'));
assert.ok(menu.search(index,'汁物','冷やし').some(x=>x.display==='冷やし味噌汁'));
assert.ok(menu.search(index,'汁物','冷やし味噌汁').some(x=>x.display==='冷やし味噌汁'));
assert.ok(menu.search(index,'おやつ','柿ジャム').some(x=>x.name==='柿ジャムの豆乳寒天'));
assert.ok(index.dates.get('2026-09-11').some(x=>x.name.includes('絹さや')));
assert.deepEqual(menu.parts('梅酢きゅうり・かき氷','おやつ'),['かき氷']);
assert.equal(menu.normalizeSearch('大根と人参'),menu.normalizeSearch('大根・人参'));
const daikon=menu.build([
  [2026,9,1,'煮物','切干大根煮（人参・あげ）',1],
  [2026,9,2,'煮物','切干し大根煮（人参・ごぼう）',1],
  [2026,9,3,'煮物','切り干し大根煮（人参）',1],
  [2026,9,4,'煮物','大根と人参の煮物',1],
  [2026,9,5,'煮物','切干大根と大根・人参の煮物',1]
]);
assert.deepEqual(menu.search(daikon,'煮物','大根 人参').map(x=>x.dates[0]),['2026-09-05','2026-09-04']);
assert.equal(menu.search(daikon,'煮物','切干大根').length,4);
assert.equal(menu.search(daikon,'煮物','切り干し大根').length,4);
assert.equal(menu.search(daikon,'煮物','大根').length,2);
const ties=menu.build([
  [2026,9,1,'メイン','古い料理',1],[2026,9,2,'メイン','古い料理',1],
  [2026,9,4,'メイン','新しい料理',1],[2026,9,5,'メイン','新しい料理',1],
  [2026,9,3,'メイン','一度だけ',1]
]);
assert.deepEqual(menu.search(ties,'メイン','','count','new').slice(0,2).map(x=>x.name),['新しい料理','古い料理']);
assert.deepEqual(menu.search(ties,'メイン','','count','old').slice(0,2).map(x=>x.name),['古い料理','新しい料理']);
assert.deepEqual(menu.search(ties,'メイン','','few','old').map(x=>x.name),['一度だけ','古い料理','新しい料理']);
assert.equal(menu.normalizeSearch('さといも'),'さといも');
assert.equal(menu.dateKey(2026,2,30),null);
assert.deepEqual(menu.parts('サラダ（レタス／トマト）／みそ汁','おやつ'),['サラダ（レタス／トマト）']);
assert.deepEqual(menu.gvizRows({status:'ok',table:{rows:[{c:[{v:'年度'}]},{c:[{v:2026},{v:9},{v:7},{v:'メイン'},{v:'豆腐ハンバーグ'},{v:2}]}]}}),[[2026,9,7,'メイン','豆腐ハンバーグ',2]]);
assert.deepEqual(menu.csvRows('年度,月,日,区分,料理名,記載順\r\n2026,9,7,サラダ,"野菜,豆（ごま）",1\r\n'),[['2026','9','7','サラダ','野菜,豆（ごま）','1']]);
assert.deepEqual(menu.csvRows('年度,月,日,区分,料理名,記載順\n2026,9,7,サラダ,"野菜""豆\n和え",1'),[['2026','9','7','サラダ','野菜"豆\n和え','1']]);
assert.throws(()=>menu.csvRows('年度,月,日,区分,料理名,記載順\n2026,9,7,サラダ,野菜,1,extra'));
console.log('menu-search core: OK');
