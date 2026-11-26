/* Read KOSIS originals without rewriting a student's workbook.
   Parsing is not approval: table bindings and temporal evidence live in the registry. */
(function(root){
'use strict';
const C=typeof module==='object'?require('./core.js'):root.KosisCore;
const R=typeof module==='object'?require('./region-crosswalk.js'):root.RegionCrosswalk;
const text=v=>String(v??'').trim();
function read(book,X){
 const sheet=book.Sheets['데이터'],metaSheet=book.Sheets['메타정보'];
 if(!sheet||!metaSheet)return null;
 const meta=X.utils.sheet_to_json(metaSheet,{header:1,defval:''});
 const get=k=>{const found=meta.filter(r=>text(r[0])===k);return found.length===1?text(found[0][1]):'';};
 const tableId=get('○ 통계표ID');if(!tableId)return null;
 const fail=m=>{throw Error('KOSIS 원본 확인: '+m);};
 let url;try{url=new URL(get('○ 통계표URL'));}catch{fail('메타정보의 공식 출처 URL이 없습니다.');}
 if(url.protocol!=='https:'||url.hostname!=='kosis.kr'||url.pathname!=='/statHtml/statHtml.do'||url.searchParams.get('tblId')!==tableId||!/^\d+$/.test(url.searchParams.get('orgId')||''))fail('공식 출처와 통계표 ID가 일치하지 않습니다.');
 const period=get('○ 조회기간').match(/^\[년\]\s*(\d{4})~(\d{4})$/);
 if(!period||period[1]!==period[2])fail('한 연도만 선택한 연간 자료가 필요합니다. 월·분기·여러 연도는 현재 지원하지 않습니다.');
 if(Object.entries(sheet).some(([k,c])=>!k.startsWith('!')&&c.f))fail('원본에 수식이 있습니다. KOSIS에서 받은 파일을 그대로 넣어 주세요.');
 const original=X.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true});
 const src=C.expand(original,sheet['!merges']||[]);
 const dims=src[0]?.filter(v=>/^\w+ .+\(\d+\)$/.test(text(v))).length||0;
 if(!dims||dims>5||!src[1]||src[0].slice(0,dims).some((v,i)=>v!==src[1][i])||src[0].slice(dims).some(v=>text(v)!=='Y'+period[1]+' '+period[1]))fail('지원하지 않는 표 구조입니다. 행에 행정구역, 열에 한 연도와 항목을 선택하세요.');
 const dimension=text(src[0][0]).split(' ')[0];
 if((sheet['!merges']||[]).some(m=>m.e.r>=2&&m.e.c>=dims))fail('통계값 영역의 병합 셀은 값을 복제할 수 있어 변환하지 않습니다.');
 if(src[0].slice(0,dims).some((v,i)=>!text(v).startsWith(dimension+' ')||!text(v).endsWith('('+(i+1)+')')))fail('여러 지역 분류나 성별·연령별 행을 한 번에 연결하지 않습니다.');
 const metrics=src[1].slice(dims).map((v,i)=>{const m=text(v).match(/^([A-Za-z0-9_]+)\s+(.+)$/);if(!m)fail('항목 코드가 없습니다. 다운로드에서 코드 포함을 선택하세요.');return {id:m[1],label:m[2].replace(/<br\s*\/?\s*>/gi,' '),column:i+4};});
 if(!metrics.length||new Set(metrics.map(m=>m.id)).size!==metrics.length)fail('통계 항목 코드가 없거나 중복됩니다.');
 const records=[];
 for(let i=2;i<src.length;i++){
  const r=src[i];if(r.every(v=>!text(v)))continue;
  if(r.slice(dims+metrics.length).some(v=>text(v)))fail((i+1)+'행에 머리글 없는 값이 있습니다.');
  const hierarchy=r.slice(0,dims).map(text);
  const identities=hierarchy.filter(v=>v!=='소계').map(v=>{const m=v.match(/^(\d+)\s+(.+)$/);if(!m)fail((i+1)+'행 지역 코드가 없습니다. 다운로드에서 코드 포함을 선택하세요.');return {code:m[1],name:m[2]};});
  if(!identities.length)fail((i+1)+'행 지역 정보가 없습니다.');
  const last=identities.at(-1),first=identities[0];
  records.push({sourceRow:i+1,sourceCode:last.code,name:last.name,province:first.name,year:period[1],hierarchy,values:metrics.map((m,j)=>r[dims+j]??'')});
 }
 const headers=['source_code','지역명','시도명','통계연도',...metrics.map(m=>m.id+' '+m.label)];
 return {orgId:url.searchParams.get('orgId'),tableId,title:get('○ 통계표명'),statYear:period[1],sourceUrl:url.href,downloadedAt:get('○ 자료다운일자'),dimension,metrics,records,headers,rows:[headers,...records.map(r=>[r.sourceCode,r.name,r.province,r.year,...r.values])]};
}
function blocked(input,settings,type,detail){return {output:[],headers:['code','name','sido','sido_name','base_year'],audit:[],issues:[{row:0,type,detail}],spatial:{sourceUnit:settings.confirmedUnit,targetUnit:settings.targetUnit,blocked:true,reason:detail},summary:{status:'결합 중단',input:input?.records?.length||0,matched:0,duplicates:0,aggregate:0,unmatched:0,missing:[],empty:0,outside:0,scope:settings.scope,period:input?.statYear||settings.period||'',expected:null,boundaryWarning:false}};}
function convert(input,registry,refs,settings,boundaryHash){
 const stop=(type,message)=>blocked(input,settings,type,message);
 if(!input)return stop('원본 정보 없음','통계표·코드체계를 확인할 수 없습니다. KOSIS 원본 XLSX를 코드 포함으로 내려받아 넣어 주세요.');
 if(!settings.unitConfirmed||!['sido','sgg'].includes(settings.targetUnit)||settings.targetUnit!==settings.confirmedUnit)return stop('지역 단위 확인','원본과 같은 지도 단위를 선택하고 확인해 주세요.');
 if(settings.customReference||Object.keys(settings.fixes||{}).length||settings.aggregation!=='none')return stop('지원하지 않는 변환','검증된 경계에서 원본 값을 그대로 연결합니다. 지역 직접 변경·행 제외·집계는 사용할 수 없습니다.');
 if(settings.period!==input.statYear||settings.code!==0||settings.name!==1||settings.sido!==2||settings.year!==3)return stop('원본 설정 불일치','원본 코드·지역명·시도·연도 열을 변경할 수 없습니다.');
 const metrics=(settings.metrics||[]).map(c=>input.metrics.find(m=>m.column===c));
 if(!metrics.length||metrics.some(m=>!m))return stop('항목 확인','원본의 통계 항목을 하나 이상 선택하세요.');
 const profiles=(registry?.profiles||[]).filter(p=>p.orgId===input.orgId&&p.tableId===input.tableId&&p.statYear===input.statYear&&p.level===settings.targetUnit&&p.dimension===input.dimension);
 if(profiles.length!==1)return stop('미지원 통계표','이 통계표·연도·지역 단계의 코드 대응이 아직 검증되지 않았습니다. 원본을 보존했습니다. DETAIL에서 검증 상태를 확인하세요.');
 const p=profiles[0];
 if(metrics.some(m=>!p.items?.includes(m.id)))return stop('미지원 통계 항목','선택한 항목은 이 표의 검증 범위에 포함되지 않습니다.');
 const boundaries=refs[p.level].map(r=>({code:r.code,name:r.name,province:r.sido_name,year:r.base_year,level:p.level}));
 let targets=refs[p.level].filter(r=>settings.scope==='all'||settings.scope==='sample'||r.sido===settings.scope);
 if(settings.scope==='sample'){
  const codes=settings.selectedCodes;
  if(!Array.isArray(codes)||!codes.length||new Set(codes).size!==codes.length||codes.some(c=>!targets.some(t=>t.code===c)))return stop('선택 지역 확인','일부 지역을 비교할 때는 지도에 표시할 지역을 직접 선택하세요.');
  targets=targets.filter(r=>codes.includes(r.code));
 }
 const selected=new Set(targets.map(t=>t.code)),allEntries=new Map((p.entries||[]).map(e=>[e.sourceCode,e]));
 const sourceRows=[];let outside=0;
 for(const r of input.records){
  const e=allEntries.get(r.sourceCode);
  // Only explicitly registered rows can be omitted. Unknowns are never name-filtered away.
  if(e&&!selected.has(e.targetCode)){outside++;continue;}
  const ignored=(p.excludedRows||[]).some(x=>x.sourceCode===r.sourceCode&&x.name===r.name&&JSON.stringify(x.hierarchy)===JSON.stringify(r.hierarchy));
  if(ignored){outside++;continue;}
  sourceRows.push({...r,level:p.level});
 }
 const resolved=R.resolveBatch({registry,profileId:p.id,context:{orgId:input.orgId,tableId:input.tableId,itemId:p.itemId,statYear:input.statYear,statDate:p.statDate,boundaryYear:p.boundaryYear,codeSystem:p.codeSystem,level:p.level},rows:sourceRows,boundaries,expectedCodes:targets.map(t=>t.code),boundaryHash});
 if(resolved.status!=='지역 대응 완료'){const r=stop('코드 대응 중단',resolved.issues[0]?.detail||'공식 코드 대응 근거를 확인하세요.');r.issues=resolved.issues;r.crosswalk=resolved;return r;}
 const output=[],audit=[],issues=[];
 for(const r of resolved.output){
  const target=targets.find(t=>t.code===r.code),out={...target,kosis_source_code:r.sourceCode,stat_year:input.statYear};
  for(const m of metrics){const raw=r.values[input.metrics.indexOf(m)],n=C.number(raw);if(n.kind!=='number')issues.push({row:r.sourceRow,type:n.kind==='missing'?'결측값':'수치 오류',detail:m.label,code:r.sourceCode});out[m.id]=n.value;audit.push({source_row:r.sourceRow,source_code:r.sourceCode,gis_code:r.code,name:r.name,metric:m.id,original_value:raw,output_value:n.value,comparison:n.kind==='number'?'일치':'미변환'});}
  output.push(out);
 }
 if(issues.length){const r=stop('통계값 확인','선택 지역에 결측값 또는 수치 오류가 있습니다. 0으로 바꾸지 않습니다.');r.issues=issues;r.audit=audit;return r;}
 return {output,headers:['code','name','sido','sido_name','base_year','kosis_source_code','stat_year',...metrics.map(m=>m.id)],audit,issues:[],crosswalk:{profileId:p.id,registryVersion:registry.version,audit:resolved.audit},spatial:{sourceUnit:p.level,targetUnit:p.level},summary:{status:'결합 가능',input:input.records.length,matched:output.length,duplicates:0,aggregate:0,unmatched:0,missing:[],empty:0,outside,scope:settings.scope,period:input.statYear,expected:targets.length,boundaryWarning:input.statYear!==p.boundaryYear}};
}
const api={read,convert,blocked};if(typeof module==='object')module.exports=api;else root.KosisWorkbook=api;
})(globalThis);
