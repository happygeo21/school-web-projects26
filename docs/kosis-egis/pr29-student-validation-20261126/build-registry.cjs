/* Reproduce the registry from preserved official originals; no statistics values here. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),X=require(path.join(root,'kosis-egis-tool/vendor/xlsx-0.20.3.full.min.js'));
const qa=process.argv[2];if(!qa)throw Error('Pass the extracted Codex-QA-20261126 directory');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),norm=s=>String(s).replace(/\s/g,'');
const files=['KSSC_20241231_original.xlsx','KSSC_20250101_original.xlsx','KSSC_20261001_original.xlsx'];
const expected=['23b7589e9b7b7b73ed0c48d4aff4163f28df2b5186e918617178a1b47aa82bc0','11ba74f7492eefe2ef02016719d09f93e076162fa35ca5aed1771526876ebe4d','06f899f0a7cb4caf92de880e2a4071f88ab2324dde75c985b9863f06b296a9dd'];
const books=files.map((f,i)=>{const bytes=fs.readFileSync(path.join(qa,'Official_References',f));assert.equal(hash(bytes),expected[i]);return X.read(bytes,{type:'buffer'});});
const read=(b,prefix)=>X.utils.sheet_to_json(b.Sheets[b.SheetNames.find(n=>n.startsWith(prefix))],{header:1,defval:''});
const snapshots=books.slice(0,2).map(b=>read(b,'2-2.').map((r,i)=>({sourceRow:i+1,sourceCode:String(r[5]),sourceName:r[2],province:r[0],administrativeCode:String(r[6]),legalCode:String(r[8]),created:String(r[7]),split:r[9]})).filter(r=>/^(\d{2}|\d{5})$/.test(r.sourceCode)));
assert.equal(snapshots[0].length,281);assert.equal(snapshots[1].length,281);
const refs={sido:require(path.join(root,'kosis-egis-tool/sido-reference.json')),sgg:require(path.join(root,'kosis-egis-tool/reference.json'))};
const regions=snapshots[1].map(r=>{
 const old=snapshots[0].find(x=>x.sourceCode===r.sourceCode);for(const k of ['sourceName','province','administrativeCode','legalCode','created','split'])assert.equal(old[k],r[k],r.sourceCode+' '+k);
 assert.equal(r.split,'');assert.equal(r.administrativeCode,r.legalCode);
 const level=r.sourceCode.length===2?'sido':'sgg',len=level==='sido'?2:5;
 assert(new RegExp('^\\d{'+len+'}0{'+(10-len)+'}$').test(r.administrativeCode));
 // An explicit official row is matched against the actual boundary key, never by name.
 const target=refs[level].find(x=>x.code===r.administrativeCode.slice(0,len));
 if(target){assert.equal(norm(target.name),r.sourceCode==='29010'?'세종시':norm(r.sourceName));assert.equal(target.sido_name,r.province);}
 const province=snapshots[1].find(x=>x.sourceCode.length===2&&x.sourceName===r.province);assert(province);
 return {...r,sourceRows:{'2024-12-31':old.sourceRow,'2025-01-01':r.sourceRow},level:target?level:'city',provinceSourceCode:province.sourceCode,provinceTargetCode:province.administrativeCode.slice(0,2),targetCode:target?.code||null,targetName:target?.name||null};
});
for(const r of regions){r.ancestors=[];if(r.level!=='sido'){r.ancestors.push(r.provinceSourceCode);const city=regions.find(x=>x.level==='city'&&x.province===r.province&&r.sourceName.startsWith(x.sourceName+' '));if(city)r.ancestors.push(city.sourceCode);}}
for(const level of ['sido','sgg'])assert.equal(regions.filter(x=>x.level===level).length,refs[level].length);
const changes=read(books[2],'1.').map((r,i)=>({sourceRow:i+1,area:String(r[1]).trim(),note:r.find(v=>typeof v==='string'&&/시행일:\s*2025/.test(v))})).filter(x=>x.note);
// All 2025 notices concern subdivisions within the named city/district. 2026
// reorganizations are NOT authorization to apply new classification to 2024 data.
assert.equal(changes.length,15);
const baseUrl='https://kssc.mods.go.kr:8443/ksscNew_web/';
const sources=files.map((f,i)=>({id:'kssc-'+['20241231','20250101','20261001'][i],kind:'official-original',file:f,sha256:expected[i],downloadedAt:'2026-11-26',referenceDate:['2024-12-31','2025-01-01','2026-10-01'][i],url:i<2?baseUrl+'upload/'+encodeURIComponent('한국행정구역분류_'+(i?'2025.1.1.':'2024.12.31.')+'기준_20241231100033.xlsx'):baseUrl+'kssc/common/CommonBoardList.do?categoryMenu=011&gubun=1&strBbsId=kasctnr&strCategoryNameCode=019',terms:'공공누리 제3유형(출처표시·변경금지). 원문 보존. 코드·명칭·연계 사실값과 원문 셀 위치를 인용하며 원문 개작본으로 배포하지 않음.',termsStatus:'verified',termsUrl:baseUrl+'kssc/common/copyright.do?gubun=1'}));
const binding=(tableId,dimension,items,levels=['sido','sgg'])=>({orgId:'101',tableId,dimension,statYear:'2024',standardSet:'kac-2024-egis-2025',items,levels,reviewState:'verified'});
const registry={schemaVersion:2,version:'2026-11-26-student-1',reviewState:'approved',sources,codeSystems:[{id:'kostat-kac',kind:'official-standard',name:'한국행정구역분류'}],profiles:[],standardSets:[{id:'kac-2024-egis-2025',codeSystem:'kostat-kac',statYear:'2024',statDate:'2024-12-31',classificationDates:['2024-12-31','2025-01-01'],boundaryYear:'2025',validFrom:'2024-01-18',validThrough:'2024-12-31',compatibility:'verified',sourceIds:sources.map(s=>s.id),temporalEvidence:'KSSC 2024말/2025초 281개 상위 구역 코드·명칭·행정기관·법정동 연계 동일. 2026.10.1 원문의 2025년 변경내역 15건은 시군구 내부 동/리 변경. 시도17·시군구252 실제 경계 속성 전수 일치. 좌표 동일성 검증은 요구하지 않음. 읍면동, 2026 개편구역, 상위 시→일반구 분배 제외.',boundaryHashes:Object.fromEntries(['sido','sgg'].map(l=>[l,hash(fs.readFileSync(path.join(root,'kosis-egis-tool',l==='sido'?'sido-2025.geojson':'sigungu-2025.geojson')))])),regions}],tableBindings:[binding('DT_1YL21161','SGG',['T10','T20','T30']),binding('DT_1B8000H','B',['T12'],['sido']),{...binding('INH_1B81A17','A',['value'],['sido']),singleMetric:{title:'합계출산율(시도/시/군/구)',label:'합계출산율',unit:'가임여성 1명당 명',identitySource:'single-measure-metadata'}},binding('DT_1YL20621','SGG',['T10','T20','T30']),binding('DT_1YL20842','SGG',['T10','T20','T30']),binding('DT_1YL20622','A',['T10','T20','T30']),binding('DT_1YL20931','SGG',['T10','T20','T30']),binding('DT_1YL21281','SGG',['T10','T20','T30']),binding('DT_1YL20981','SGG',['T10','T20','T30']),binding('DT_1YL202004','A',['T10','T20','T30']),binding('DT_1YL20643','A',['10/11'])],status:'공식 공통 코드 연계는 전국 17개 시도와 252개 시군구 경계에서 검증. 표별 원본 분류와 공간 단위가 같은 행만 변환. 2026 통합·개편 분류 및 상위 시 합계는 차단.'};
// Bind only indicators actually inspected in the fixed originals. The common
// resolver is shared; these records identify the table, metric and its unit.
const W=require(path.join(root,'kosis-egis-tool/kosis-workbook.js'));
const originalFiles=[...fs.readdirSync(path.join(qa,'inputs')).filter(f=>f.endsWith('.xlsx')).map(f=>path.join(qa,'inputs',f)),...['fertility-2024.xlsx','population-2024.xlsx'].map(f=>path.join(root,'tests/kosis-egis/fixtures/crosswalk-20261126',f))];
const units={DT_1YL21161:'%',DT_1B8000H:'가임여성 1명당 명',INH_1B81A17:'가임여성 1명당 명',DT_1YL20621:'%',DT_1YL20842:'개',DT_1YL20622:'%',DT_1YL20931:'개',DT_1YL21281:'천㎡',DT_1YL20981:'명',DT_1YL202004:'%',DT_1YL20643:'%'};
for(const b of registry.tableBindings){
 const source=originalFiles.map(file=>{const bytes=fs.readFileSync(file);return {file,bytes,input:W.read(X.read(bytes,{type:'buffer'}),X)};}).find(s=>s.input?.tableId===b.tableId);
 assert(source,b.tableId);const metric=source.input.metrics[0];b.items=[metric.id];b.unit=units[b.tableId];
 b.itemDefinitions={[metric.id]:{label:metric.label,unit:b.unit}};
 b.originalEvidence={file:path.basename(source.file),sha256:hash(source.bytes),title:source.input.title,downloadedAt:source.input.downloadedAt,sourceUrl:source.input.sourceUrl};
}
fs.writeFileSync(path.join(root,'kosis-egis-tool/region-registry.json'),JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'official-linkage-audit.json'),JSON.stringify({sourceHashes:expected,originalsPreserved:true,officialRows:281,sidoMatched:17,sggMatched:252,parentCities:regions.filter(r=>r.level==='city'),changes2025:changes,coordinateEqualityRequired:false,scopeInterpretation:registry.standardSets[0].temporalEvidence},null,2)+'\n');
console.log(JSON.stringify({official:281,sido:17,sgg:252,cities:regions.filter(r=>r.level==='city').length,changes:changes.length}));
