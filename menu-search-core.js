(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MenuSearchCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const categories=['サラダ','煮物','メイン','汁物','ご飯','おやつ'];
  const chewing=/^(?:梅酢人参|梅酢きゅうり|梅ごぼう|昆布|早煮昆布|煮干し|にぼし|いりこ|するめ|蒸干し|ブロッコリーの茎|ブロッコリーの芯|キャベツの芯|昆布またはブロッコリーの芯|きゅうり|ゆかりきゅうり|ミディトマト|ミニトマト|葉付き人参|スティックセニョール|ブロッコリー|田作り|スナップえんどう)$/;
  const ingredients='(?:大根|だいこん|人参|にんじん|玉ねぎ|玉ネギ|じゃがいも|じゃが芋|蓮根|れんこん|きゅうり|胡瓜|キャベツ|白菜|かぼちゃ|南瓜|こんにゃく|糸こんにゃく|トマト|なす|茄子|豆腐|小松菜|法蓮草|ほうれん草|わかめ|昆布|ごぼう|牛蒡)';
  const conjunction=new RegExp('('+ingredients+')と(?='+ingredients+')','g');
  function categoryOf(value){
    const s=String(value||'');
    if(s==='メイン'||s==='主菜'||s.startsWith('メイン・'))return 'メイン';
    if(s.startsWith('サラダ'))return 'サラダ';
    if(s.startsWith('煮物'))return '煮物';
    if(s==='汁物'||s==='汁')return '汁物';
    if(s==='ご飯'||s.startsWith('ご飯・')||s==='主食'||s.startsWith('行事'))return 'ご飯';
    if(s==='おやつ'||s==='おやつ・共通'||s==='おやつ・高年齢'||
      /^おやつ（(?:高年齢|3[～〜-]5歳|3歳以上|3,4,5歳)）$/.test(s))return 'おやつ';
    return null;
  }
  function parts(text,category){
    const original=String(text||'').trim();
    if(!original)return [];
    if(category!=='おやつ')return [original];
    // 元資料の「／」だけを料理の区切りとして扱う。材料の括弧内は分割しない。
    const result=[];let depth=0,part='';
    for(const ch of original){
      if(ch==='（'||ch==='(')depth++;
      if(ch==='）'||ch===')')depth=Math.max(0,depth-1);
      if((ch==='／'||ch==='/')&&depth===0){if(part.trim())result.push(part.trim());part='';}
      else part+=ch;
    }
    if(part.trim())result.push(part.trim());
    return result.map(s=>{
      const prefix=s.match(/^([^・]+)・(.+)$/);
      return prefix&&chewing.test(prefix[1])?prefix[2].trim():s;
    }).filter(s=>s&&!chewing.test(s)&&!/^みそ汁$|^味噌汁$/.test(s));
  }
  function dateKey(year,month,day){
    const y=Number(year),m=Number(month),d=Number(day),date=new Date(Date.UTC(y,m-1,d));
    if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function normalizeSearch(value){
    return String(value||'').normalize('NFKC').toLocaleLowerCase('ja-JP')
      // Keep dried daikon as its own ingredient token before joining delimiters.
      // A dish listing both dried and fresh daikon still contains the latter.
      .replace(/切(?:り)?干(?:し)?大根/g,'\uE000')
      .replace(/じゃが芋|ジャガイモ/g,'じゃがいも')
      .replace(/さつま芋|サツマイモ|薩摩芋/g,'さつまいも')
      .replace(/玉ネギ|たまねぎ/g,'玉ねぎ')
      .replace(/インゲン/g,'いんげん')
      .replace(/\s+/g,'')
      .replace(conjunction,'$1')
      .replace(/[\s\u3000・／/、,()（）「」『』［］\[\]]+/g,'');
  }
  function identity(name,category){
    if(category==='煮物'&&/^じゃが煮(?:[（(].*[）)])?$/.test(name)){
      const konjac=/こんにゃく/.test(name);
      return konjac?{key:'じゃが煮（こんにゃく入り）',display:'じゃが煮（こんにゃく入り）',alias:'じゃがいも'}:
        {key:'じゃが煮',display:'じゃが煮',alias:'じゃがいも'};
    }
    if(category==='煮物'&&/^ごろっとじゃが煮/.test(name))
      return {key:name,display:name,alias:'じゃがいも'};
    if(category==='汁物'&&/^(?:みそ汁|味噌汁)(?:[（(].*[）)])?$/.test(name))
      return {key:'味噌汁',display:'味噌汁',alias:'みそ汁 味噌汁'};
    if(category==='汁物'&&name.includes('みそ汁'))
      return {key:name,display:name.replace(/みそ汁/g,'味噌汁'),alias:name.replace(/みそ汁/g,'味噌汁')};
    if(category==='サラダ'){
      const base=name.split(/[（(]/)[0];
      const explicit=[
        ['豆乳マヨ',/豆乳マヨ(?:ネーズ)?/],['バルサミコ',/バルサミコ/],
        ['三杯酢',/三杯酢/],['柚子',/(?:柚子|ゆず)(?:ドレ|ポン酢)/],
        ['レモン',/レモン(?:ドレ|すだち)/],['ごま',/(?:ごま|胡麻)(?:ドレ|酢|和え|サラダ)/]
      ].find(([,pattern])=>pattern.test(name));
      const flavor=explicit?.[0]||'';
      const short=base.replace(/の(?:三杯酢|柚子ドレッシング|豆乳ドレッシング|生姜ドレッシング)$/, '').trim();
      return {key:name,display:flavor?`${flavor}｜${short}`:short,alias:flavor};
    }
    return {key:name,display:name,alias:''};
  }
  // Add only ingredients inherent in these named dishes. Variable recipes and
  // ambiguous labels (e.g. 蒸かし芋 or 蒸しパン) remain searchable by their record.
  function ingredientAliases(name,category){
    const terms=[],title=name.split(/[（(]/)[0];
    if(/(?:おむすび|おにぎり|キンパ|巻き寿司|ちらし寿司|いなり寿司|稲荷寿司|おいなりさん|^いなり$|五平餅|おはぎ|ごはん|ご飯|菜めし|七草粥)/.test(title)||
      (category==='おやつ'||category==='ご飯')&&/(?:海苔巻き|のり巻き)/.test(title))terms.push('ご飯','米飯');
    if(/(?:大学芋|鬼まんじゅう|スイートポテト|紫芋羊羹|^焼き芋$)/.test(name))terms.push('さつまいも');
    if(/ポテト/.test(name.replace(/スイートポテト/g,''))||/ポテサラ/.test(name))terms.push('じゃがいも');
    if(/(?:白和え|飛龍頭|飛竜頭)/.test(name))terms.push('豆腐');
    if(/(?:コーンスープ|コーンごはん|コーンのサラダ)/.test(name))terms.push('とうもろこし');
    return terms;
  }
  function build(rows){
    const dates=new Map(),dishes=new Map();
    for(const source of rows){
      const [year,month,day,rawCategory,rawName,order]=source;
      const date=dateKey(year,month,day),category=categoryOf(rawCategory);
      if(!date||!category||!rawName)continue;
      const list=parts(rawName,category);
      for(const name of list){
        const id=identity(name,category),key=`${category}\u0000${id.key}`;
        let dish=dishes.get(key);
        if(!dish){dish={key,category,name:id.key,display:id.display,dates:[],search:''};dishes.set(key,dish);}
        dish.search+=` ${normalizeSearch(name)} ${normalizeSearch(id.alias)} ${ingredientAliases(name,category).map(normalizeSearch).join(' ')}`;
        if(!dish.dates.includes(date))dish.dates.push(date);
        let dayList=dates.get(date);
        if(!dayList){dayList=[];dates.set(date,dayList);}
        if(!dayList.some(x=>x.key===key&&x.name===name))dayList.push({key,category,name,order:Number(order)||0});
      }
    }
    for(const dish of dishes.values())dish.dates.sort((a,b)=>b.localeCompare(a));
    for(const list of dates.values())list.sort((a,b)=>a.order-b.order||categories.indexOf(a.category)-categories.indexOf(b.category));
    return {categories,dates,dishes:[...dishes.values()]};
  }
  function search(index,category='',query='',sort='new',dateDirection='new'){
    const q=normalizeSearch(query);
    const list=index.dishes.filter(x=>(!category||x.category===category)&&(!q||x.search.includes(q)));
    const cmp=(a,b)=>a.display.localeCompare(b.display,'ja');
    const byDate=(a,b)=>dateDirection==='old'?a.dates[0].localeCompare(b.dates[0]):b.dates[0].localeCompare(a.dates[0]);
    list.sort((a,b)=>sort==='count'?b.dates.length-a.dates.length||byDate(a,b)||cmp(a,b):
      sort==='few'?a.dates.length-b.dates.length||byDate(a,b)||cmp(a,b):
      sort==='old'?a.dates[0].localeCompare(b.dates[0])||cmp(a,b):
      b.dates[0].localeCompare(a.dates[0])||cmp(a,b));
    return list;
  }
  function previousYear(index,category,today=new Date()){
    if(!categories.includes(category))return {target:'',anchor:'',dates:[]};
    // Use the device's calendar day. UTC conversion can shift the day in Japan.
    const year=today.getFullYear()-1;
    const target=`${year}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const dates=[...index.dates.keys()].filter(date=>date.startsWith(`${year}-`)&&
      index.dates.get(date).some(item=>item.category===category)).sort((a,b)=>b.localeCompare(a));
    return {target,anchor:dates.find(date=>date<=target)||dates.at(-1)||'',dates};
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
  return {categories,categoryOf,parts,dateKey,normalizeSearch,identity,ingredientAliases,build,search,previousYear,gvizRows,csvRows};
});
