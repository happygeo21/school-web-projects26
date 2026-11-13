const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const X=require('xlsx'),A=require('../../kosis-egis-tool/aging-xlsx.js'),C=require('../../kosis-egis-tool/core.js');
const refs={sgg:require('../../kosis-egis-tool/reference.json'),sido:require('../../kosis-egis-tool/sido-reference.json')},provenance=require('./fixtures/real-2024/provenance.json');
const book=unit=>X.read(fs.readFileSync(path.join(__dirname,'fixtures/real-2024',provenance.books[unit].file)),{type:'buffer'});
const settings=unit=>({unitConfirmed:true,confirmedUnit:unit,targetUnit:unit,scope:unit==='sgg'?'46':'all',period:'2024',aggregation:'none',metrics:[5],name:1,code:0,sido:3,year:7});
for(const unit of ['sgg','sido']){
 test(`${unit}: unchanged real XLSX bytes, all codes and values survive CSV`,()=>{
  const b=book(unit),p=provenance.books[unit],bytes=fs.readFileSync(path.join(__dirname,'fixtures/real-2024',p.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256);
  const before=JSON.stringify(b),input=A.read(b,X,refs),r=A.convert(input,settings(unit));assert.equal(JSON.stringify(b),before);assert.equal(r.output.length,p.compared);const official=require('./fixtures/real-2024/official-response.json').data;for(const row of r.output){const match=official.filter(x=>x.classification===row.name&&x.period==='2024'&&x.unit==='%');assert.equal(match.length,1);assert.equal(Number(match[0].value),row.aging_pct);}
  const csv=C.parseDelimited(C.csv(r.output,r.headers)),hs=csv.shift();assert.equal(csv.length,p.compared);
  for(const [i,row] of csv.entries()){assert.equal(row[hs.indexOf('code')],r.audit[i].gis_code);assert.equal(Number(row[hs.indexOf('aging_pct')]),r.audit[i].original_value);assert.equal(row[hs.indexOf('kosis_source_code')],r.audit[i].source_code);assert.equal(row[hs.indexOf('year')],'2024');assert.equal(row[hs.indexOf('unit')],'%');}
 });
 const metric=unit==='sgg'?'D':'C';
 for(const [label,mutate] of Object.entries({
  'wrong year':b=>b.Sheets['데이터'][metric+'1'].v='Y2023 2023',
  'wrong item':b=>b.Sheets['데이터'][metric+'2'].v='T001 65세이상인구 (명)',
  'missing':b=>b.Sheets['데이터'][metric+'3'].v='',
  'text number':b=>b.Sheets['데이터'][metric+'3'].v='21.2',
  'wrong value':b=>b.Sheets['데이터'][metric+'3'].v=99,
  'formula':b=>b.Sheets['데이터'][metric+'3'].f='1+1',
  'wrong parent':b=>b.Sheets['데이터'].A3.v='31 경기도',
  'duplicate':b=>{for(const col of unit==='sgg'?['A','B','C','D']:['A','B','C'])b.Sheets['데이터'][col+'4']={...b.Sheets['데이터'][col+'3']};},
  'missing row':b=>b.Sheets['데이터']['!ref']=unit==='sgg'?'A1:D23':'A1:C18',
  'extra monthly column':b=>{b.Sheets['데이터']['!ref']=unit==='sgg'?'A1:E24':'A1:D19';b.Sheets['데이터'][unit==='sgg'?'E1':'D1']={t:'s',v:'M202412'};},
  'wrong table':b=>b.Sheets['메타정보'].B1.v='OTHER',
  'wrong meta year':b=>b.Sheets['메타정보'].B3.v='[년] 2023~2024',
  'wrong unit':b=>b.Sheets['메타정보'].B8.v='명',
  'merged cells':b=>b.Sheets['데이터']['!merges']=[{s:{r:2,c:0},e:{r:3,c:0}}]
 }))test(`${unit}: blocks ${label}`,()=>{const b=book(unit);mutate(b);assert.throws(()=>A.read(b,X,refs));});
 test(`${unit}: settings cannot bypass scope, year, metrics or reference`,()=>{const input=A.read(book(unit),X,refs);for(const change of [{period:'2025'},{scope:'sample'},{metrics:[6]},{unitConfirmed:false},{customReference:true},{name:0},{fixes:{3:'46790'}}])assert.throws(()=>A.convert(input,{...settings(unit),...change}));});
}
test('unrelated workbook stays on existing converter path',()=>assert.equal(A.read({Sheets:{}},X,refs),null));
