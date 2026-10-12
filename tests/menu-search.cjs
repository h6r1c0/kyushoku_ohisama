const assert=require('node:assert/strict');
const menu=require('../menu-search-core.js');
const fs=require('node:fs'),path=require('node:path');
assert.match(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),/<script src="menu-search-config\.js"><\/script>\s*<script src="menu-search\.js"><\/script>/);
const rows=[
  [2026,9,7,'サラダ','コーンのサラダ（きゅうり・赤玉ねぎ）',1],
  [2026,9,7,'主菜','豆腐ハンバーグ',2],
  [2026,9,7,'おやつ（1・2歳）','梅酢人参／みそ汁／焼きおにぎり',3],
  [2026,9,7,'おやつ（3・4・5歳）','梅酢人参／焼きおにぎり',4],
  [2026,9,8,'サラダ・和え物','コーンのサラダ（きゅうり・赤玉ねぎ）',1],
  [2026,9,8,'おやつ','梅酢人参',2],
  [2026,9,8,'果物','日向夏',3],
  [2026,9,9,'休園','給食なし',1],
  [2026,9,10,'ご飯・主食','おむすび',1],
  [2026,9,10,'行事食（主食・汁物一体）','天の川素麺（星人参）',2]
];
const index=menu.build(rows);
assert.deepEqual(index.categories,['メイン','サラダ','煮物','汁物','ご飯','おやつ']);
assert.equal(menu.search(index,'サラダ','赤玉ねぎ').length,1);
assert.equal(menu.search(index,'サラダ','コーン')[0].dates.length,2);
assert.equal(menu.search(index,'メイン','豆腐')[0].dates[0],'2026-09-07');
assert.equal(menu.search(index,'おやつ','梅酢人参')[0].dates.length,2);
assert.equal(menu.search(index,'おやつ','焼きおにぎり')[0].dates.length,1);
assert.equal(menu.search(index,'おやつ','みそ汁')[0].dates.length,1);
assert.equal(menu.search(index,'ご飯','')[0].dates[0],'2026-09-10');
assert.equal(menu.search(index,'果物').length,0);
assert.equal(index.dates.get('2026-09-07').filter(x=>x.name==='梅酢人参').length,1);
assert.equal(menu.search(index,'サラダ','','old')[0].dates.at(-1),'2026-09-07');
assert.equal(menu.search(index,'おやつ','','count')[0].dates.length,2);
assert.equal(menu.dateKey(2026,2,30),null);
assert.deepEqual(menu.parts('サラダ（レタス／トマト）／みそ汁','おやつ'),['サラダ（レタス／トマト）','みそ汁']);
assert.deepEqual(menu.gvizRows({status:'ok',table:{rows:[{c:[{v:'年度'}]},{c:[{v:2026},{v:9},{v:7},{v:'メイン'},{v:'豆腐ハンバーグ'},{v:2}]}]}}),[[2026,9,7,'メイン','豆腐ハンバーグ',2]]);
assert.deepEqual(menu.csvRows('年度,月,日,区分,料理名,記載順\r\n2026,9,7,サラダ,"野菜,豆（ごま）",1\r\n'),[['2026','9','7','サラダ','野菜,豆（ごま）','1']]);
assert.deepEqual(menu.csvRows('年度,月,日,区分,料理名,記載順\n2026,9,7,サラダ,"野菜""豆\n和え",1'),[['2026','9','7','サラダ','野菜"豆\n和え','1']]);
assert.throws(()=>menu.csvRows('年度,月,日,区分,料理名,記載順\n2026,9,7,サラダ,野菜,1,extra'));
console.log('menu-search core: OK');
