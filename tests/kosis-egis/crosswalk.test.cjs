const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=require('../../kosis-egis-tool/region-crosswalk.js'),W=require('../../kosis-egis-tool/kosis-workbook.js'),C=require('../../kosis-egis-tool/core.js'),X=require('../../kosis-egis-tool/vendor/xlsx-0.20.3.full.min.js');
const hash='a'.repeat(64);
function fixture(){
 const entry={sourceCode:'36',sourceName:'전라남도',province:'전라남도',targetCode:'46',targetName:'전라남도',relation:'one-to-one',sourceHierarchy:['36 전라남도']};
 const profile={id:'synthetic-test',orgId:'TEST',tableId:'TEST',itemId:'T1',items:['T1'],dimension:'SGG',statYear:'2024',statDate:'2024-12-31',boundaryYear:'2025',level:'sido',codeSystem:'test-standard',reviewState:'verified',compatibility:'verified',validFrom:'2024-01-01',validThrough:'2025-12-31',temporalEvidence:'SYNTHETIC TEST ONLY',evidence:'SYNTHETIC TEST ONLY',sourceUrl:'https://example.invalid/test',sourceIds:['test'],boundarySha256:hash,entries:[entry]};
 return {registry:{schemaVersion:2,version:'TEST ONLY',reviewState:'approved',codeSystems:[{id:'test-standard',kind:'official-standard'}],sources:[{id:'test',url:'https://example.invalid/test',downloadedAt:'2026-11-26',referenceDate:'2024-12-31',terms:'synthetic test',termsStatus:'verified',sha256:hash}],profiles:[profile]},profileId:profile.id,context:{orgId:'TEST',tableId:'TEST',itemId:'T1',statYear:'2024',statDate:'2024-12-31',boundaryYear:'2025',level:'sido',codeSystem:'test-standard'},rows:[{sourceCode:'36',name:'전라남도',province:'전라남도',year:'2024',level:'sido',hierarchy:['36 전라남도'],value:0}],boundaries:[{code:'46',name:'전라남도',province:'전라남도',year:'2025',level:'sido'}],expectedCodes:['46'],boundaryHash:hash};
}
test('explicit synthetic namespace mapping preserves real zero, leaves inputs untouched',()=>{const i=fixture(),before=JSON.stringify(i),r=R.resolveBatch(i);assert.equal(r.status,'지역 대응 완료');assert.equal(r.output[0].code,'46');assert.equal(r.output[0].value,0);assert.equal(JSON.stringify(i),before);});
for(const [name,mutate,type] of [
 ['schema 1 cannot be promoted by approved flag',i=>i.registry.schemaVersion=1,'REGISTRY_UNAPPROVED'],
 ['code system collision',i=>i.context.codeSystem='mois-legal','CODE_SYSTEM_UNVERIFIED'],
 ['unknown same-name code',i=>i.rows[0].sourceCode='999','UNKNOWN_SOURCE_CODE'],
 ['numeric-only region code',i=>i.rows[0].sourceCode=36,'UNKNOWN_SOURCE_CODE'],
 ['missing code no name fallback',i=>i.rows[0].sourceCode='','UNKNOWN_SOURCE_CODE'],
 ['wrong parent',i=>i.rows[0].province='세종특별자치시','SOURCE_IDENTITY_MISMATCH'],
 ['wrong hierarchy',i=>i.rows[0].hierarchy=['29 세종특별자치시'],'SOURCE_HIERARCHY_MISMATCH'],
 ['one to many',i=>i.registry.profiles[0].entries[0].relation='one-to-many','RELATION_UNSUPPORTED'],
 ['many to one',i=>i.registry.profiles[0].entries.push({...i.registry.profiles[0].entries[0],sourceCode:'37'}),'CROSSWALK_AMBIGUOUS'],
 ['duplicate source row',i=>i.rows.push({...i.rows[0]}),'DUPLICATE_TARGET'],
 ['wrong boundary file',i=>i.boundaryHash='b'.repeat(64),'BOUNDARY_VERSION_MISMATCH'],
 ['missing source digest',i=>delete i.registry.sources[0].sha256,'PROVENANCE_MISSING'],
 ['unverified time compatibility',i=>i.registry.profiles[0].compatibility='unknown','TEMPORAL_COMPATIBILITY_UNVERIFIED'],
 ['date outside validity',i=>i.context.statDate='2023-12-31','TEMPORAL_COMPATIBILITY_UNVERIFIED'],
 ['wrong stat year',i=>i.context.statYear='2023','TEMPORAL_COMPATIBILITY_UNVERIFIED'],
 ['wrong boundary identity',i=>i.boundaries[0].name='세종특별자치시','TARGET_IDENTITY_MISMATCH'],
 ['duplicate expected selection',i=>i.expectedCodes.push('46'),'SCOPE_INVALID'],
 ['missing selected target',i=>{i.boundaries.push({code:'11',name:'서울특별시',province:'서울특별시',year:'2025',level:'sido'});i.expectedCodes.push('11');},'MISSING_TARGET']
])test(name,()=>{const i=fixture();mutate(i);const r=R.resolveBatch(i);assert.equal(r.status,'결합 중단');assert.deepEqual(r.output,[]);assert.ok(r.issues.some(x=>x.type===type),JSON.stringify(r.issues));});
const workbook=()=>X.read(fs.readFileSync(path.join(__dirname,'fixtures/crosswalk-20261126/households-2024.xlsx')),{type:'buffer'});
test('actual KOSIS download: all 248 source rows, 744 original cells and hierarchy preserved',()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'fixtures/crosswalk-20261126/households-2024.xlsx')),provenance=require('./fixtures/crosswalk-20261126/provenance.json');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),provenance.sha256);
 const b=workbook(),before=JSON.stringify(b),input=W.read(b,X),raw=X.utils.sheet_to_json(b.Sheets['데이터'],{header:1,defval:''});assert.equal(input.tableId,'DT_1YL21161');assert.equal(input.statYear,'2024');assert.equal(input.records.length,248);assert.equal(input.records.filter(r=>r.province==='서울특별시').length,26);
 input.records.forEach((r,i)=>{assert.deepEqual(r.hierarchy,raw[i+2].slice(0,3));assert.deepEqual(r.values,raw[i+2].slice(3));});assert.equal(JSON.stringify(b),before);
 const result=W.convert(input,require('../../kosis-egis-tool/region-registry.json'),{sido:require('../../kosis-egis-tool/sido-reference.json'),sgg:require('../../kosis-egis-tool/reference.json')},{unitConfirmed:true,targetUnit:'sgg',confirmedUnit:'sgg',period:'2024',aggregation:'none',name:1,code:0,sido:2,year:3,scope:'11',metrics:[4]});assert.equal(result.summary.status,'결합 중단');assert.equal(result.issues[0].type,'미지원 통계표');assert.deepEqual(result.output,[]);
});
for(const [name,mutate] of [
 ['formula',b=>b.Sheets['데이터'].D5.f='1+1'],
 ['missing source code',b=>b.Sheets['데이터'].B5.v='종로구'],
 ['value merge',b=>b.Sheets['데이터']['!merges']=[{s:{r:3,c:3},e:{r:4,c:3}}]],
 ['wrong metadata table',b=>b.Sheets['메타정보'].B1.v='UNKNOWN'],
 ['several years',b=>b.Sheets['메타정보'].B3.v='[년] 2023~2024'],
 ['wrong header year',b=>b.Sheets['데이터'].D1.v='Y2025 2025']
])test('actual workbook mutation rejects '+name,()=>{const b=workbook();mutate(b);assert.throws(()=>W.read(b,X));});
function conversionInput(value=4){const i=fixture();return {i,input:{orgId:'TEST',tableId:'TEST',statYear:'2024',dimension:'SGG',metrics:[{id:'T1',column:4,label:'합성값'}],records:[{sourceCode:'36',name:'전라남도',province:'전라남도',year:'2024',hierarchy:['36 전라남도'],sourceRow:3,values:[value]}]},refs:{sido:[{code:'46',name:'전라남도',sido:'46',sido_name:'전라남도',base_year:'2025'}]},settings:{unitConfirmed:true,targetUnit:'sido',confirmedUnit:'sido',period:'2024',scope:'sample',selectedCodes:['46'],aggregation:'none',code:0,name:1,sido:2,year:3,metrics:[4]}};}
test('explicit subset uses selected boundaries and preserves value through CSV',()=>{const {i,input,refs,settings}=conversionInput(0),r=W.convert(input,i.registry,refs,settings,hash);assert.equal(r.summary.status,'결합 가능');assert.equal(r.output[0].T1,0);const csv=C.parseDelimited(C.csv(r.output,r.headers));assert.equal(csv.length,2);assert.equal(csv[1].at(-1),'0');});
for(const value of ['',null,'-','N/A','bad'])test('missing/invalid values never become zero: '+String(value),()=>{const {i,input,refs,settings}=conversionInput(value),r=W.convert(input,i.registry,refs,settings,hash);assert.equal(r.summary.status,'결합 중단');assert.deepEqual(r.output,[]);});
test('sample requires explicit selection',()=>{const {i,input,refs,settings}=conversionInput();settings.selectedCodes=[];assert.equal(W.convert(input,i.registry,refs,settings,hash).summary.status,'결합 중단');});
test('unverified arbitrary CSV cannot use old name-based converter in production',()=>{assert.equal(W.convert(null,{}, {},{}).summary.status,'결합 중단');const worker=fs.readFileSync(path.join(__dirname,'../../kosis-egis-tool/conversion-worker.js'),'utf8');assert.match(worker,/data.strict\?KosisWorkbook.convert/);});
