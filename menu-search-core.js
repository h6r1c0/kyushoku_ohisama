(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MenuSearchCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const categories=['メイン','サラダ','煮物','汁物','ご飯','おやつ'];
  function categoryOf(value){
    const s=String(value||'');
    if(s==='メイン'||s==='主菜'||s.startsWith('メイン・'))return 'メイン';
    if(s.startsWith('サラダ'))return 'サラダ';
    if(s.startsWith('煮物'))return '煮物';
    if(s==='汁物'||s==='汁')return '汁物';
    if(s==='ご飯'||s.startsWith('ご飯・')||s==='主食'||s.startsWith('行事'))return 'ご飯';
    if(s.startsWith('おやつ')||s==='0歳児おやつ')return 'おやつ';
    return null;
  }
  function parts(text,category){
    const original=String(text||'').trim();
    if(category!=='おやつ'||!original.includes('／'))return original?[original]:[];
    // 元資料の「／」だけを料理の区切りとして扱う。材料の括弧内は分割しない。
    const result=[];let depth=0,part='';
    for(const ch of original){
      if(ch==='（'||ch==='(')depth++;
      if(ch==='）'||ch===')')depth=Math.max(0,depth-1);
      if(ch==='／'&&depth===0){if(part.trim())result.push(part.trim());part='';}
      else part+=ch;
    }
    if(part.trim())result.push(part.trim());
    return result;
  }
  function dateKey(year,month,day){
    const y=Number(year),m=Number(month),d=Number(day),date=new Date(Date.UTC(y,m-1,d));
    if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function normalizeSearch(s){return String(s||'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/\s+/g,'');}
  function build(rows){
    const dates=new Map(),dishes=new Map();
    for(const source of rows){
      const [year,month,day,rawCategory,rawName,order]=source;
      const date=dateKey(year,month,day),category=categoryOf(rawCategory);
      if(!date||!category||!rawName)continue;
      const list=parts(rawName,category);
      for(const name of list){
        const key=`${category}\u0000${name}`;
        let dish=dishes.get(key);
        if(!dish){dish={key,category,name,dates:[],search:normalizeSearch(name)};dishes.set(key,dish);}
        if(!dish.dates.includes(date))dish.dates.push(date);
        let dayList=dates.get(date);
        if(!dayList){dayList=[];dates.set(date,dayList);}
        if(!dayList.some(x=>x.key===key))dayList.push({key,category,name,order:Number(order)||0});
      }
    }
    for(const dish of dishes.values())dish.dates.sort((a,b)=>b.localeCompare(a));
    for(const list of dates.values())list.sort((a,b)=>a.order-b.order||categories.indexOf(a.category)-categories.indexOf(b.category));
    return {categories,dates,dishes:[...dishes.values()]};
  }
  function search(index,category,query='',sort='new'){
    const q=normalizeSearch(query);
    const list=index.dishes.filter(x=>x.category===category&&(!q||x.search.includes(q)));
    const cmp=(a,b)=>a.name.localeCompare(b.name,'ja');
    list.sort((a,b)=>sort==='count'?b.dates.length-a.dates.length||b.dates[0].localeCompare(a.dates[0])||cmp(a,b):sort==='old'?a.dates.at(-1).localeCompare(b.dates.at(-1))||cmp(a,b):b.dates[0].localeCompare(a.dates[0])||cmp(a,b));
    return list;
  }
  function gvizRows(response){
    if(response.status!=='ok'||!response.table||!Array.isArray(response.table.rows))throw new Error('献立データを取得できませんでした');
    const rows=response.table.rows.map(row=>row.c.map(cell=>cell?.v??''));
    return rows[0]?.[0]==='年度'?rows.slice(1):rows;
  }
  function csvRows(text){
    const rows=[];let row=[],field='',quoted=false;
    const input=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(ch==='"'){
        if(quoted&&input[i+1]==='"'){field+='"';i++;}
        else quoted=!quoted;
      }else if(ch===','&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){
        if(ch==='\r'&&input[i+1]==='\n')i++;
        row.push(field);rows.push(row);row=[];field='';
      }else field+=ch;
    }
    if(quoted)throw new Error('献立データのCSV形式が不正です');
    if(row.length||field){row.push(field);rows.push(row);}
    const headers=['年度','月','日','区分','料理名','記載順'];
    if(!rows.length||rows[0].length!==6||headers.some((h,i)=>rows[0][i]!==h)||rows.some(r=>r.length!==6))throw new Error('献立データの列構成が不正です');
    return rows.slice(1);
  }
  return {categories,categoryOf,parts,dateKey,normalizeSearch,build,search,gvizRows,csvRows};
});
