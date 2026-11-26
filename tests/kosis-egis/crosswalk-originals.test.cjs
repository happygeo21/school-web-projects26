const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const X=require('../../kosis-egis-tool/vendor/xlsx-0.20.3.full.min.js'),W=require('../../kosis-egis-tool/kosis-workbook.js');
const dir=path.join(__dirname,'fixtures/crosswalk-20261126'),books=require('./fixtures/crosswalk-20261126/additional-provenance.json').books;
for(const p of books)test('official original: '+p.file,()=>{
 const bytes=fs.readFileSync(path.join(dir,p.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256);
 const b=X.read(bytes,{type:'buffer'}),before=JSON.stringify(b),raw=X.utils.sheet_to_json(b.Sheets['데이터'],{header:1,defval:'',raw:true});
 assert.equal(raw.length,p.records+p.headerRows);
 if(p.parserStatus==='unsupported'){assert.throws(()=>W.read(b,X),/머리글|분류/);assert.equal(JSON.stringify(b),before);return;}
 const input=W.read(b,X);assert.equal(input.tableId,p.tableId);assert.equal(input.statYear,p.statYear);assert.equal(input.records.length,p.records);
 for(const [i,r] of input.records.entries()){assert.deepEqual(r.hierarchy,raw[i+p.headerRows].slice(0,p.dimensions).map(v=>String(v).trim()));assert.deepEqual(r.values,raw[i+p.headerRows].slice(p.dimensions));}
 assert.equal(JSON.stringify(b),before);
 const r=W.convert(input,require('../../kosis-egis-tool/region-registry.json'),{}, {unitConfirmed:true,targetUnit:'sgg',confirmedUnit:'sgg',period:'2024',aggregation:'none',name:1,code:0,sido:2,year:3,scope:'all',metrics:[4]});assert.equal(r.summary.status,'결합 중단');assert.deepEqual(r.output,[]);
});
test('flat district exports do not invent a parent province from a name or code',()=>{
 for(const file of ['business-gyeongbuk-2024.xlsx','culture-seoul-subset-2024.xlsx']){const w=W.read(X.read(fs.readFileSync(path.join(dir,file)),{type:'buffer'}),X);assert(w.records.every(r=>r.province===''));assert(w.records.every(r=>r.hierarchy.length===1));}
});
test('Gangwon population source includes exactly 18 districts plus its province total',()=>{
 const w=W.read(X.read(fs.readFileSync(path.join(dir,'population-2024.xlsx')),{type:'buffer'}),X),rows=w.records.filter(r=>r.province==='강원특별자치도');assert.equal(rows.length,19);assert.equal(rows.filter(r=>r.hierarchy[1]==='소계').length,1);assert.equal(rows.filter(r=>r.hierarchy[1]!=='소계').length,18);
});
