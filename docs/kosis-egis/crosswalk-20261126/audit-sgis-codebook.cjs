/* Review evidence only. Never adds profiles or changes runtime mappings.
   Run from the repository root with the preserved official adm_code XLS path. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.cwd(),X=require(path.join(root,'kosis-egis-tool/vendor/xlsx-0.20.3.full.min.js')),W=require(path.join(root,'kosis-egis-tool/kosis-workbook.js'));
const bytes=fs.readFileSync(process.argv[2]),book=X.read(bytes,{type:'buffer'}),snapshots={};
const norm=s=>String(s).normalize('NFKC').replace(/\s/g,'');
for(const year of ['2024','2025']){
 const sheet=year+'년 6월',rows=X.utils.sheet_to_json(book.Sheets[sheet],{header:1,defval:''});
 assert.deepEqual(rows[1],['시도코드','시도명칭','시군구코드','시군구명칭','읍면동코드','읍면동명칭']);
 const maps={sido:new Map(),sgg:new Map()};
 for(let i=2;i<rows.length;i++){
  const r=rows[i];if(r.every(x=>x===''))continue;
  // This official codebook stores a three-digit district component as mixed
  // numbers/text; restore that component's leading zeros, never student codes.
  const sido=String(r[0]),rawPart=String(r[2]);assert.match(sido,/^\d{2}$/);assert.match(rawPart,/^\d{1,3}$/);assert(r[1]&&r[3]);const part=rawPart.padStart(3,'0');
  for(const [level,e] of [['sido',{code:sido,name:r[1],province:r[1]}],['sgg',{code:sido+part,name:r[3],province:r[1]}]]){
   const old=maps[level].get(e.code);if(old)assert.deepEqual({code:old.code,name:old.name,province:old.province},e);else maps[level].set(e.code,{...e,sourceRow:i+1});
  }
 }
 snapshots[year]={sheet,referenceDate:year+'-06-30',sido:[...maps.sido.values()],sgg:[...maps.sgg.values()]};
 assert.equal(snapshots[year].sido.length,17);assert.equal(snapshots[year].sgg.length,252);
}
const records=[];
for(const [level,file] of [['sido','sido-reference.json'],['sgg','reference.json']])for(const target of require(path.join(root,'kosis-egis-tool',file))){
 const candidates={};for(const year of ['2024','2025'])candidates[year]=snapshots[year][level].filter(r=>norm(r.province)===norm(target.sido_name)&&norm(r.name)===norm(target.name));
 records.push({level,target,candidates,reviewState:'candidate-only',reason:'Official code/name snapshots are not a KAC-to-MOIS linkage table or proof of unchanged geometry.'});
}
const differences=[];for(const level of ['sido','sgg']){
 const previous=new Map(snapshots['2024'][level].map(r=>[r.code,r])),next=new Map(snapshots['2025'][level].map(r=>[r.code,r]));
 for(const code of new Set([...previous.keys(),...next.keys()])){
  const a=previous.get(code),b=next.get(code);if(!a||!b||a.name!==b.name||a.province!==b.province)differences.push({level,code,previous:a,current:b});
 }
}
const sourceChecks=[];
for(const file of ['households-2024.xlsx','population-2024.xlsx','business-gyeongbuk-2024.xlsx','old-housing-2024.xlsx','culture-seoul-subset-2024.xlsx']){
 const input=W.read(X.read(fs.readFileSync(path.join(root,'tests/kosis-egis/fixtures/crosswalk-20261126',file)),{type:'buffer'}),X);
 const index=new Map([...snapshots['2024'].sido,...snapshots['2024'].sgg].map(r=>[r.code,r]));
 const checks=input.records.map(r=>{const official=index.get(r.sourceCode);return {sourceRow:r.sourceRow,sourceCode:r.sourceCode,name:r.name,province:r.province,official:official||null,codeExists:!!official,nameMatches:!!official&&norm(r.name)===norm(official.name),parentProvided:!!r.province,parentMatches:!!official&&!!r.province&&norm(r.province)===norm(official.province)};});
 sourceChecks.push({file,tableId:input.tableId,statYear:input.statYear,rows:checks.length,matchedCodeAndName:checks.filter(r=>r.codeExists&&r.nameMatches).length,completeIdentityMatches:checks.filter(r=>r.codeExists&&r.nameMatches&&r.parentMatches).length,unresolved:checks.filter(r=>!r.codeExists||!r.nameMatches||!r.parentMatches),classification:'diagnostic only; no inference that this table uses SGIS codes for every row'});
}
const result={reviewState:'candidate-only',sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sheets:book.SheetNames,snapshots,codeNameDifferences2024To2025:differences,boundaryCandidateCount:records.length,uniqueNameCandidateCount:records.filter(r=>r.candidates['2025'].length===1).length,unresolvedBoundaries:records.filter(r=>r.candidates['2025'].length!==1).map(r=>r.target),records,sourceChecks,approvedProfiles:0};
fs.writeFileSync(path.join(root,'docs/kosis-egis/crosswalk-20261126/sgis-codebook-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:result.sourceSha256,codeNameDifferences:differences,boundaryCandidateCount:records.length,uniqueNameCandidateCount:result.uniqueNameCandidateCount,unresolvedBoundaries:result.unresolvedBoundaries,sourceChecks:sourceChecks.map(({unresolved,...c})=>({...c,unresolvedCount:unresolved.length,unknownExamples:unresolved.filter(r=>!r.codeExists).slice(0,4)}))},null,2));
