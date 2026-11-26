// Seed regression; schema 1 production promotion now fails earlier at registry validation.
const assert=require('node:assert/strict');
const {resolveBatch}=require('../../../kosis-egis-tool/region-crosswalk.js');
const registry=require('./registry.fixture.json');
const cases=require('./cases.fixture.json');
let passed=0;const test=(name,fn)=>{fn();console.log('PASS',name);passed++;};
const clone=structuredClone;
function input(c){const p=registry.profiles.find(x=>x.id===c.profileId);const {orgId,tableId,itemId,statYear,boundaryYear,level}=p;return {registry:clone(registry),profileId:p.id,context:{orgId,tableId,itemId,statYear,boundaryYear,level},rows:clone(c.rows),boundaries:clone(c.boundaries),expectedCodes:[...c.expectedCodes],allowFixture:true};}
for(const c of cases)test(c.profileId+' '+c.rows.length+' regions, all values and codes unchanged',()=>{const r=resolveBatch(input(c));assert.equal(r.status,'테스트 대응 성공');assert.equal(r.matched,c.expectedCodes.length);assert.equal(r.audit.length,c.expectedCodes.length);for(const row of r.output)assert.equal(row.value,c.expectedValues[row.code]);});
const s=cases.find(x=>x.profileId==='fertility-sido'), seoul=cases.find(x=>x.profileId==='households-seoul');
function negative(name,change,type,c=s){test(name,()=>{const i=input(c);change(i);const r=resolveBatch(i);assert.equal(r.status,'결합 중단');assert.equal(r.output.length,0);assert.ok(r.issues.some(x=>x.type===type),JSON.stringify(r.issues));});}
negative('fixture cannot run in production',i=>i.allowFixture=false,'REGISTRY_UNAPPROVED');
negative('unknown table namespace',i=>i.context.tableId='DT_UNKNOWN','CONTEXT_MISMATCH');
negative('wrong item namespace',i=>i.context.itemId='T999','CONTEXT_MISMATCH');
negative('wrong statistical year',i=>i.context.statYear='2025','CONTEXT_MISMATCH');
negative('wrong boundary year',i=>i.context.boundaryYear='2026','CONTEXT_MISMATCH');
negative('wrong spatial level',i=>i.context.level='sgg','CONTEXT_MISMATCH');
negative('numeric collision: 36 does not mean Sejong in this namespace',i=>{let x=i.rows.find(x=>x.sourceCode==='36');x.name='세종특별자치시';x.province='세종특별자치시';},'SOURCE_IDENTITY_MISMATCH');
negative('same-name district wrong parent',i=>i.rows.find(x=>x.name==='중구').province='부산광역시','SOURCE_IDENTITY_MISMATCH',seoul);
negative('unknown code not bypassed by name',i=>i.rows[0].sourceCode='999999','UNKNOWN_SOURCE_CODE');
negative('missing code not bypassed by name',i=>i.rows[0].sourceCode='','UNKNOWN_SOURCE_CODE');
negative('wrong row year',i=>i.rows[0].year='2023','ROW_CONTEXT_MISMATCH');
negative('mixed spatial units',i=>i.rows[0].level='sgg','ROW_CONTEXT_MISMATCH');
negative('duplicate input row',i=>i.rows.push(clone(i.rows[0])),'DUPLICATE_TARGET');
negative('missing selected region',i=>i.rows.pop(),'MISSING_TARGET');
negative('conflicting boundary name',i=>i.boundaries[0].name='다른 지역','TARGET_IDENTITY_MISMATCH');
negative('duplicate mapping source code',i=>{const p=i.registry.profiles.find(p=>p.id===i.profileId);p.entries[1].sourceCode=p.entries[0].sourceCode;},'CROSSWALK_AMBIGUOUS');
negative('duplicate mapping target code',i=>{const p=i.registry.profiles.find(p=>p.id===i.profileId);p.entries[1].targetCode=p.entries[0].targetCode;},'CROSSWALK_AMBIGUOUS');
negative('out-of-scope row',i=>i.expectedCodes.pop(),'OUT_OF_SCOPE');
negative('malformed source row',i=>i.rows[0]=null,'ROW_INVALID');
negative('malformed boundary entry',i=>i.boundaries[0]=null,'BOUNDARY_INVALID');
negative('unverified compatibility in production',i=>{i.registry.reviewState='approved';i.allowFixture=false;},'REGISTRY_UNAPPROVED');
test('sample scope only explicit selected boundaries',()=>{const i=input(seoul);i.rows=i.rows.slice(0,3);i.expectedCodes=i.expectedCodes.slice(0,3);assert.equal(resolveBatch(i).matched,3);});
test('code 36 mapped to 46, original kept',()=>{const r=resolveBatch(input(s));const x=r.output.find(x=>x.kosisSourceCode==='36');assert.equal(x.code,'46');assert.equal(x.name,'전라남도');});
test('value zero or missing passed unchanged to upstream/downstream metric validator (not approval)',()=>{const i=input(s);i.rows[0].value='0';i.rows[1].value='';const r=resolveBatch(i);assert.equal(r.output[0].value,'0');assert.equal(r.output[1].value,'');});
console.log(`${passed} tests passed; ${cases.reduce((n,c)=>n+c.rows.length,0)} fixture rows checked (not independent official verification).`);
