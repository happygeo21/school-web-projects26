/* Based on the supplied eGIS_region_crosswalk_Codex_seed.
   Pure resolver: schema 1 is fixture-only; production requires schema 2 evidence.
   Never infer a code system from digit count, a matching number, or a name. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RegionCrosswalk=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=v=>typeof v==='string'?v.normalize('NFKC').trim().replace(/\s+/g,''):'';
const id=v=>typeof v==='string'?v.trim():'';
const code=v=>typeof v==='string'&&/^\d+$/.test(v)?v:'';
const issue=(type,detail,row=null)=>({type,detail,row});
function resolveBatch({registry,profileId,context,rows,boundaries,expectedCodes,allowFixture=false,boundaryHash}={}){
  const issues=[],audit=[],resolved=[];
  const fail=()=>({status:'결합 중단',issues,audit,output:[],matched:resolved.length,expected:Array.isArray(expectedCodes)?expectedCodes.length:null});
  if(!registry||![1,2].includes(registry.schemaVersion)||!Array.isArray(registry.profiles)||!id(registry.version)){
    issues.push(issue('REGISTRY_INVALID','지원하지 않는 코드 대응표입니다.'));return fail();
  }
  const fixture=registry.reviewState==='fixture-only'&&allowFixture===true;
  if(!fixture&&(registry.schemaVersion!==2||registry.reviewState!=='approved')){
    issues.push(issue('REGISTRY_UNAPPROVED','검증·승인되지 않은 대응표입니다.'));return fail();
  }
  const selected=registry.profiles.filter(p=>p&&p.id===profileId);
  if(selected.length!==1){issues.push(issue('PROFILE_UNKNOWN','검증된 원본 통계표/코드 체계를 식별할 수 없습니다.'));return fail();}
  const p=selected[0];
  if(!fixture){
    const systems=(registry.codeSystems||[]).filter(s=>s.id===p.codeSystem);
    const evidence=(registry.sources||[]).filter(s=>Array.isArray(p.sourceIds)&&p.sourceIds.includes(s.id));
    if(systems.length!==1||!['official-standard','table-classification'].includes(systems[0].kind)||context?.codeSystem!==p.codeSystem||p.reviewState!=='verified'){
      issues.push(issue('CODE_SYSTEM_UNVERIFIED','이 통계표의 코드체계가 검증되지 않았습니다. 숫자나 이름으로 대신 연결하지 않습니다.'));return fail();
    }
    if(!evidence.length||evidence.length!==new Set(p.sourceIds).size||evidence.some(s=>!/^https:\/\//.test(s.url||'')||!/^\d{4}-\d{2}-\d{2}/.test(s.downloadedAt||'')||!s.referenceDate||!s.terms||s.termsStatus!=='verified'||!/^[a-f0-9]{64}$/.test(s.sha256||''))){
      issues.push(issue('PROVENANCE_MISSING','공식 원본의 출처·기준시점·다운로드일·해시·이용조건 기록이 없습니다.'));return fail();
    }
    if(!/^[a-f0-9]{64}$/.test(boundaryHash||'')||p.boundarySha256!==boundaryHash){
      issues.push(issue('BOUNDARY_VERSION_MISMATCH','검증된 실제 지도 경계 파일과 다릅니다.'));return fail();
    }
    if(p.compatibility!=='verified'||!id(p.temporalEvidence)||!/^\d{4}-\d{2}-\d{2}$/.test(p.validFrom||'')||!/^\d{4}-\d{2}-\d{2}$/.test(p.validThrough||'')||context.statDate<p.validFrom||context.statDate>p.validThrough||!/^\d{4}-\d{2}-\d{2}$/.test(context.statDate||'')||!context.statDate.startsWith(context.statYear)){
      issues.push(issue('TEMPORAL_COMPATIBILITY_UNVERIFIED','통계 시점과 경계 시점 사이의 행정구역 개편 검증이 필요합니다.'));return fail();
    }
  }
  if(!context||!['sido','sgg'].includes(p.level)||!['orgId','tableId','itemId','statYear','boundaryYear','level'].every(k=>id(context[k])&&context[k]===p[k])){
    issues.push(issue('CONTEXT_MISMATCH','통계표·항목·연도·공간 단위가 대응표와 일치하지 않습니다.'));return fail();
  }
  if(!id(p.evidence)||!id(p.sourceUrl)||(!fixture&&p.compatibility!=='verified')){
    issues.push(issue('PROVENANCE_MISSING','공식 출처 및 통계/경계 시점 호환 검증이 필요합니다.'));return fail();
  }
  if(!Array.isArray(p.entries)||!Array.isArray(rows)||!rows.length||!Array.isArray(boundaries)||!Array.isArray(expectedCodes)||!expectedCodes.length){
    issues.push(issue('INPUT_INVALID','원본 행·선택 경계·기대 지역을 확인하세요.'));return fail();
  }
  const byBoundary=new Map(),bySource=new Map(),byTarget=new Set(),expected=new Set();
  const len=p.level==='sido'?2:5;
  for(const b of boundaries){
    if(!b||typeof b!=='object'||!code(b.code)||b.code.length!==len||b.level!==p.level||b.year!==p.boundaryYear||!norm(b.name)||!norm(b.province)||byBoundary.has(b.code)){
      issues.push(issue('BOUNDARY_INVALID','경계 코드·공간 단위·기준연도·중복을 확인하세요.'));continue;
    }
    byBoundary.set(b.code,b);
  }
  for(const c of expectedCodes){
    if(!code(c)||expected.has(c)||!byBoundary.has(c))issues.push(issue('SCOPE_INVALID','선택 경계의 지역 목록이 잘못되었습니다.'));
    expected.add(c);
  }
  for(const e of p.entries){
    if(!fixture&&(e?.relation!=='one-to-one'||!Array.isArray(e?.sourceHierarchy)||!e.sourceHierarchy.length||e.sourceHierarchy.some(v=>!id(v)))){
      issues.push(issue('RELATION_UNSUPPORTED','분할·통합·상위 시/일반구 관계 또는 상위 지역 근거가 확인되지 않았습니다.'));continue;
    }
    if(!e||typeof e!=='object'||!code(e.sourceCode)||!code(e.targetCode)||e.targetCode.length!==len||!norm(e.sourceName)||!norm(e.province)||!norm(e.targetName)||bySource.has(e.sourceCode)||byTarget.has(e.targetCode)){
      issues.push(issue('CROSSWALK_AMBIGUOUS','일대일 대응표의 중복·누락 또는 코드 형식 오류입니다.'));continue;
    }
    bySource.set(e.sourceCode,e);byTarget.add(e.targetCode);
  }
  if(issues.length)return fail();
  const seen=new Set();
  rows.forEach((r,index)=>{
    const n=index+1;
    if(!r||typeof r!=='object'){issues.push(issue('ROW_INVALID','원본 행 형식을 확인하세요.',n));return;}
    const sc=code(r.sourceCode),e=bySource.get(sc);
    if(r.year!==p.statYear||r.level!==p.level){issues.push(issue('ROW_CONTEXT_MISMATCH','행별 연도 또는 공간 단위가 일치하지 않습니다.',n));return;}
    if(!e){issues.push(issue('UNKNOWN_SOURCE_CODE','등록되지 않았거나 없는 원본 코드입니다. 이름으로 우회하지 않습니다.',n));return;}
    if(!norm(r.name)||!norm(r.province)||norm(r.name)!==norm(e.sourceName)||norm(r.province)!==norm(e.province)){
      issues.push(issue('SOURCE_IDENTITY_MISMATCH','원본 지역명 또는 상위 시도가 코드와 일치하지 않습니다.',n));return;
    }
    if(!fixture&&JSON.stringify(r.hierarchy)!==JSON.stringify(e.sourceHierarchy)){
      issues.push(issue('SOURCE_HIERARCHY_MISMATCH','원본 코드의 전체 상위 지역 경로가 대응표와 다릅니다.',n));return;
    }
    const b=byBoundary.get(e.targetCode);
    if(!b||norm(b.name)!==norm(e.targetName)||norm(b.province)!==norm(e.province)){
      issues.push(issue('TARGET_IDENTITY_MISMATCH','대응표의 지역과 실제 경계 속성이 일치하지 않습니다.',n));return;
    }
    if(!expected.has(b.code)){issues.push(issue('OUT_OF_SCOPE','선택하지 않은 지역의 행입니다.',n));return;}
    if(seen.has(b.code)){issues.push(issue('DUPLICATE_TARGET','한 지도 지역에 여러 행이 있습니다.',n));return;}
    seen.add(b.code);
    // Do not coerce, round, aggregate, or substitute metric values here.
    resolved.push({...r,code:b.code,name:b.name,province:b.province,boundaryYear:b.year,kosisSourceCode:r.sourceCode});
    audit.push({row:n,profileId:p.id,registryVersion:registry.version,sourceCode:r.sourceCode,targetCode:b.code,name:b.name,province:b.province,statYear:p.statYear,boundaryYear:p.boundaryYear,evidence:p.evidence});
  });
  for(const c of expected)if(!seen.has(c))issues.push(issue('MISSING_TARGET',`선택 지역 ${c}의 통계 행이 없습니다.`));
  if(issues.length)return fail();
  return {status:fixture?'테스트 대응 성공':'지역 대응 완료',issues:[],audit,output:resolved,matched:resolved.length,expected:expected.size,fixtureOnly:fixture,warnings:p.statYear!==p.boundaryYear?['통계연도와 경계연도가 다릅니다. 이 대응표의 호환 검증 범위에서만 사용합니다.']:[]};
}
return {resolveBatch};
});
