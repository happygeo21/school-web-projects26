const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const W=require('../../kosis-egis-tool/kosis-workbook.js'),C=require('../../kosis-egis-tool/core.js'),X=require('../../kosis-egis-tool/vendor/xlsx-0.20.3.full.min.js');
const registry=require('../../kosis-egis-tool/region-registry.json'),refs={sido:require('../../kosis-egis-tool/sido-reference.json'),sgg:require('../../kosis-egis-tool/reference.json')};
const book=file=>X.read(fs.readFileSync(path.join(__dirname,'fixtures/crosswalk-20261126',file)),{type:'buffer'});
const settings=(unit='sido')=>({unitConfirmed:true,targetUnit:unit,confirmedUnit:unit,period:'2024',aggregation:'none',scope:'all',metrics:[4],code:0,name:1,sido:2,year:3});
const hash=unit=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../kosis-egis-tool',unit==='sido'?'sido-2025.geojson':'sigungu-2025.geojson'))).digest('hex');
const convert=(input,opts=settings(),reg=registry)=>W.convert(input,reg,refs,opts,hash(opts.targetUnit));
const fertility=()=>W.read(book('fertility-2024.xlsx'),X);
test('existing INH original: one header, exact 17 known values, no national aggregate',()=>{
 const input=fertility(),r=convert(input);assert.equal(input.headerRows,1);assert.equal(r.summary.status,'결합 가능');assert.equal(r.summary.outside,1);
 const expected={'11':.581,'26':.683,'27':.754,'28':.762,'29':.699,'30':.792,'31':.859,'36':1.028,'41':.789,'51':.889,'43':.882,'44':.883,'52':.808,'46':1.028,'47':.897,'48':.82,'50':.826};
 assert.deepEqual(Object.fromEntries(r.output.map(o=>[o.code,o.value])),expected);
 const rows=C.parseDelimited(C.csv(r.output,r.headers));assert.equal(rows.length,18);
 for(const o of r.output){assert.equal(o.unit,'가임여성 1명당 명');assert.equal(o.classification_date,'KSSC 기준 2024-12-31');assert.equal(o.name,refs.sido.find(x=>x.code===o.code).name);}
});
test('existing four-district original: explicit selected subset and flat parent inference by official code',()=>{
 const input=W.read(book('culture-seoul-subset-2024.xlsx'),X),r=convert(input,{...settings('sgg'),scope:'sample',selectedCodes:['11110','11140','11170','11200']});
 assert.equal(r.summary.status,'결합 가능');assert.deepEqual(r.output.map(o=>[o.code,o.T10]),[['11110',51.3],['11140',25.7],['11170',9.3],['11200',5.5]]);assert(r.output.every(o=>o.sido==='11'&&o.unit==='개'));
 assert.equal(convert(input,{...settings('sgg'),scope:'11'}).summary.status,'결합 중단');
});
test('official source linkage covers every actual boundary identity and records unmatched parent cities',()=>{
 const set=registry.standardSets[0];assert.equal(set.regions.length,281);assert.equal(set.regions.filter(e=>e.level==='city').length,12);
 for(const level of ['sido','sgg']){assert.equal(set.boundaryHashes[level],hash(level));const regions=set.regions.filter(e=>e.level===level);assert.equal(regions.length,refs[level].length);for(const target of refs[level]){const matches=regions.filter(e=>e.targetCode===target.code);assert.equal(matches.length,1);assert.equal(matches[0].targetName,target.name);assert.equal(matches[0].province,target.sido_name);assert.equal(matches[0].administrativeCode,matches[0].legalCode);assert(matches[0].sourceRows['2024-12-31']>0);}}
 assert.equal(set.regions.find(e=>e.sourceCode==='11110').targetCode,'11350'); // KAC Nowon is not MOIS Jongno
 assert.equal(set.regions.find(e=>e.sourceCode==='36').targetCode,'46'); // KAC Jeonnam is not MOIS Sejong
 assert.equal(set.regions.find(e=>e.sourceCode==='29').targetCode,'36');
});
for(const [label,mutate] of [
 ['same-name unknown code',i=>{i.records[1].sourceCode='99';i.records[1].hierarchy=['99 서울특별시'];}],
 ['same number in wrong namespace',i=>{i.records[1].sourceCode='36';i.records[1].hierarchy=['36 서울특별시'];}],
 ['wrong supplied parent',i=>i.records[1].province='경기도'],
 ['wrong source title for metadata-only item',i=>i.title='연령별 출산율'],
 ['wrong item description',i=>i.metrics[0].label='인구수'],
 ['row year changed',i=>i.records[1].year='2025'],
 ['duplicate region',i=>i.records.push({...i.records[1]})],
 ['missing value',i=>i.records[1].values[0]='-'],
 ['unknown table',i=>i.tableId='UNKNOWN'],
 ['wrong dimension',i=>i.dimension='OTHER']
])test('common registry blocks '+label,()=>{const i=fertility();mutate(i);const r=convert(i);assert.equal(r.summary.status,'결합 중단');assert.deepEqual(r.output,[]);});
test('unknown outside selection cannot be silently filtered',()=>{const i=fertility();i.records[2].sourceCode='999';i.records[2].hierarchy=['999 부산광역시'];const r=convert(i,{...settings(),scope:'sample',selectedCodes:['11']});assert.equal(r.summary.status,'결합 중단');});
test('table binding cannot erase source, temporal, registry or boundary safeguards',()=>{
 for(const mutate of [r=>r.reviewState='candidate',r=>r.sources[0].sha256='',r=>r.standardSets[0].compatibility='unknown',r=>r.standardSets[0].boundaryHashes.sido='0'.repeat(64)]){const r=structuredClone(registry);mutate(r);assert.equal(convert(fertility(),settings(),r).summary.status,'결합 중단');}
});
test('physical range recovers malformed !ref without mutating source workbook',()=>{const b=book('fertility-2024.xlsx');b.Sheets['데이터']['!ref']='A1:A1';const before=JSON.stringify(b);assert.equal(W.read(b,X).records.length,18);assert.equal(JSON.stringify(b),before);});
test('ambiguous headerless measures and oversized physical cells are rejected',()=>{let b=book('fertility-2024.xlsx');b.Sheets['데이터'].C1={t:'s',v:'Y2024 2024'};b.Sheets['데이터'].C2={t:'n',v:1};assert.throws(()=>W.read(b,X),/여러 값 열/);b=book('fertility-2024.xlsx');b.Sheets['데이터'].A100001={t:'n',v:1};assert.throws(()=>W.read(b,X),/초과/);});
test('compound headers remain structured but unregistered classifications are blocked',()=>{const i=W.read(book('green-area-2024.xlsx'),X);assert.equal(i.headerRows,3);assert.equal(i.metrics[2].id,'15315JYB005/T01');assert.equal(convert(i).summary.status,'결합 중단');});
test('all unapproved secondary indicators are blocked, and missing values never become zero',()=>{const i=W.read(book('culture-seoul-subset-2024.xlsx'),X),opts={...settings('sgg'),scope:'sample',selectedCodes:['11110','11140','11170','11200']};assert.equal(convert(i,{...opts,metrics:[5]}).summary.status,'결합 중단');for(const value of ['',null,'-','N/A']){i.records[0].values[0]=value;assert.equal(convert(i,opts).summary.status,'결합 중단');}i.records[0].values[0]=0;assert.equal(convert(i,opts).output[0].T10,0);});
