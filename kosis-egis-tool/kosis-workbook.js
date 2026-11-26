/* Read KOSIS originals without rewriting a student's workbook.
   Parsing is not approval: table bindings and temporal evidence live in the registry. */
(function(root){
'use strict';
const C=typeof module==='object'?require('./core.js'):root.KosisCore;
const R=typeof module==='object'?require('./region-crosswalk.js'):root.RegionCrosswalk;
const text=v=>String(v??'').trim();
// KOSIS sometimes declares A1:A1 although physical cells extend beyond it.
// Inspect cells without changing the original workbook or trusting an enormous !ref.
function sheetRows(sheet,X){
 let end={r:0,c:0};
 for(const key of Object.keys(sheet)){if(!/^[A-Z]+[1-9]\d*$/.test(key))continue;const cell=X.utils.decode_cell(key);end.r=Math.max(end.r,cell.r);end.c=Math.max(end.c,cell.c);}
 if(end.r>=100000||end.c>=500)throw Error('시트가 100,000행 또는 500열을 초과합니다. 필요한 지역과 항목만 내려받아 주세요.');
 return X.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true,range:{s:{r:0,c:0},e:end}});
}
function read(book,X){
 const sheet=book.Sheets['데이터'],metaSheet=book.Sheets['메타정보'];
 if(!sheet||!metaSheet)return null;
 const meta=sheetRows(metaSheet,X);
 const get=k=>{const found=meta.filter(r=>text(r[0])===k);return found.length===1?text(found[0][1]):'';};
 const tableId=get('○ 통계표ID');if(!tableId)return null;
 const fail=m=>{throw Error('KOSIS 원본 확인: '+m);};
 let url;try{url=new URL(get('○ 통계표URL'));}catch{fail('메타정보의 공식 출처 URL이 없습니다.');}
 if(url.protocol!=='https:'||url.hostname!=='kosis.kr'||url.pathname!=='/statHtml/statHtml.do'||url.searchParams.get('tblId')!==tableId||!/^\d+$/.test(url.searchParams.get('orgId')||''))fail('공식 출처와 통계표 ID가 일치하지 않습니다.');
 const period=get('○ 조회기간').match(/^\[년\]\s*(\d{4})~(\d{4})$/);
 if(!period||period[1]!==period[2])fail('한 연도만 선택한 연간 자료가 필요합니다. 월·분기·여러 연도는 현재 지원하지 않습니다.');
 if(Object.entries(sheet).some(([k,c])=>!k.startsWith('!')&&c.f))fail('원본에 수식이 있습니다. KOSIS에서 받은 파일을 그대로 넣어 주세요.');
 const original=sheetRows(sheet,X);
 const src=C.expand(original,sheet['!merges']||[]);
 const dims=src[0]?.findIndex(v=>/^Y\d{4}\s/.test(text(v)))??-1;
 if(dims<1||dims>5||!src[1]||src[0].slice(dims).some(v=>text(v)!=='Y'+period[1]+' '+period[1]))fail('한 연도의 지역별 표가 필요합니다. KOSIS에서 연도를 하나만 선택하세요.');
 const dimension=text(src[0][0]).split(' ')[0];
 if(src[0].slice(0,dims).some((v,i)=>!/^\w+ .+/.test(text(v))||!text(v).startsWith(dimension+' ')||((dims>1||/\(\d+\)$/.test(text(v)))&&!text(v).endsWith('('+(i+1)+')'))))fail('여러 지역 분류나 성별·연령별 행을 한 번에 연결하지 않습니다.');
 let headerRows=1;while(headerRows<src.length&&src[headerRows].slice(0,dims).every((v,i)=>text(v)===text(src[0][i])))headerRows++;
 if(headerRows>4)fail('머리글의 분류가 너무 많습니다. 지표 하나만 선택해서 내려받아 주세요.');
 if((sheet['!merges']||[]).some(m=>m.e.r>=headerRows&&m.e.c>=dims))fail('통계값 영역의 병합 셀은 값을 복제할 수 있어 변환하지 않습니다.');
 const title=get('○ 통계표명'),unit=get('○ 단위');
 if(headerRows===1&&(src[0].length-dims!==1||!title))fail('항목 설명 없는 여러 값 열은 구분할 수 없습니다. 항목 코드를 포함해 내려받아 주세요.');
 const metrics=src[0].slice(dims).map((_,i)=>{
  const path=src.slice(1,headerRows).map(r=>{const m=text(r[dims+i]).match(/^([A-Za-z0-9_]+)\s+(.+)$/);if(!m)fail('항목 코드가 없습니다. 다운로드에서 코드 포함을 선택하세요.');return {id:m[1],label:m[2].replace(/<br\s*\/?\s*>/gi,' ')};});
  return {id:path.length?path.map(m=>m.id).join('/'):'value',label:path.length?path.map(m=>m.label).join(' / '):title,column:i+4,path,identitySource:path.length?'header':'single-measure-metadata'};
 });
 if(!metrics.length||new Set(metrics.map(m=>m.id)).size!==metrics.length)fail('통계 항목 코드가 없거나 중복됩니다.');
 const records=[];
 for(let i=headerRows;i<src.length;i++){
  const r=src[i];if(r.every(v=>!text(v)))continue;
  if(r.slice(dims+metrics.length).some(v=>text(v)))fail((i+1)+'행에 머리글 없는 값이 있습니다.');
  const hierarchy=r.slice(0,dims).map(text);
  const identities=hierarchy.filter(v=>v!=='소계').map(v=>{const m=v.match(/^([A-Za-z0-9_.]+)\s+(.+)$/);if(!m)fail((i+1)+'행 지역 코드가 없습니다. 다운로드에서 코드 포함을 선택하세요.');return {code:m[1],name:m[2]};});
  if(!identities.length)fail((i+1)+'행 지역 정보가 없습니다.');
  const last=identities.at(-1),first=identities[0];
  records.push({sourceRow:i+1,sourceCode:last.code,name:last.name,province:dims>1?first.name:'',year:period[1],hierarchy,values:metrics.map((m,j)=>r[dims+j]??'')});
 }
 const headers=['source_code','지역명','시도명','통계연도',...metrics.map(m=>m.id+' '+m.label)];
 return {orgId:url.searchParams.get('orgId'),tableId,title,unit,headerRows,statYear:period[1],sourceUrl:url.href,downloadedAt:get('○ 자료다운일자'),dimension,metrics,records,headers,rows:[headers,...records.map(r=>[r.sourceCode,r.name,r.province,r.year,...r.values])]};
}
function blocked(input,settings,type,detail){return {output:[],headers:['code','name','sido','sido_name','base_year'],audit:[],issues:[{row:0,type,detail}],spatial:{sourceUnit:settings.confirmedUnit,targetUnit:settings.targetUnit,blocked:true,reason:detail},summary:{status:'결합 중단',input:input?.records?.length||0,matched:0,duplicates:0,aggregate:0,unmatched:0,missing:[],empty:0,outside:0,scope:settings.scope,period:input?.statYear||settings.period||'',expected:null,boundaryWarning:false}};}
const norm=v=>text(v).normalize('NFKC').replace(/\s+/g,'');
function standardProfile(input,registry,level){
 const bindings=(registry?.tableBindings||[]).filter(b=>b.orgId===input.orgId&&b.tableId===input.tableId&&b.statYear===input.statYear&&b.dimension===input.dimension&&b.levels.includes(level));
 if(!bindings.length)return null;
 const error=detail=>({error:detail});
 if(bindings.length!==1||bindings[0].reviewState!=='verified')return error('이 통계표의 분류가 아직 검증되지 않았어요.');
 const binding=bindings[0],sets=(registry.standardSets||[]).filter(s=>s.id===binding.standardSet),single=input.metrics.some(m=>m.identitySource==='single-measure-metadata');
 if(sets.length!==1)return error('공식 코드표의 적용 시점을 확인할 수 없어요.');
 const set=sets[0];
 if(single&&(!binding.singleMetric||input.metrics.length!==1||input.title!==binding.singleMetric.title))return error('항목 설명이 없는 표예요. KOSIS에서 항목 코드를 포함해 내려받아 주세요.');
 const byCode=new Map(set.regions.map(e=>[e.sourceCode,e]));
 if(byCode.size!==set.regions.length)return error('공식 코드표에 중복된 지역이 있어요.');
 const records=[],entries=[],excludedRows=[],seen=new Set();
 for(const row of input.records){
  const parts=row.hierarchy.filter(h=>h!=='소계').map(h=>{const m=h.match(/^([A-Za-z0-9_.]+)\s+(.+)$/);return m?{code:m[1],name:m[2]}:null;});
  if(!parts.length||parts.some(p=>!p)||parts.at(-1).code!==row.sourceCode||norm(parts.at(-1).name)!==norm(row.name)||row.year!==input.statYear||seen.has(row.sourceCode))return error(row.sourceRow+'행의 지역 코드, 이름, 연도 또는 중복을 확인해 주세요.');
  seen.add(row.sourceCode);
  if(row.sourceCode==='00'&&row.name==='전국'&&parts.length===1){excludedRows.push({sourceCode:'00',name:'전국',hierarchy:row.hierarchy});records.push({...row,province:'전국'});continue;}
  const e=byCode.get(row.sourceCode);
  if(!e)return error(row.sourceRow+'행 '+row.name+' ('+row.sourceCode+')는 2024 공식 분류와 연결되지 않아요. 개편된 지역이 함께 있다면 KOSIS에서 탐구할 지역만 선택하고, 코드 포함과 셀 병합 해제로 다시 내려받아 주세요.');
  const path=[...e.ancestors,e.sourceCode];let previous=-1;
  for(const part of parts){const region=byCode.get(part.code),position=path.indexOf(part.code);if(!region||norm(region.sourceName)!==norm(part.name)||position<=previous)return error(row.sourceRow+'행 지역 이름이나 상위 지역이 공식 코드와 달라요. 원본의 지역 선택을 확인해 주세요.');previous=position;}
  // A flat export has no province column: obtain the parent from this exact
  // officially linked code. A supplied parent must independently agree.
  if(row.province&&norm(row.province)!==norm(e.province))return error(row.sourceRow+'행 상위 시도가 공식 코드표와 달라요.');
  const r={...row,province:e.province};records.push(r);
  if(e.level==='sido'&&level==='sgg'){excludedRows.push({sourceCode:r.sourceCode,name:r.name,hierarchy:r.hierarchy});continue;}
  if(e.level!==level)return error(row.sourceRow+'행 '+row.name+'는 '+(e.level==='city'?'상위 시 합계':'다른 지역 단위')+'예요. 일반구가 나뉜 지도에 같은 값을 나누거나 복제할 수 없어요. 원본과 같은 지역 단위의 자료를 선택해 주세요.');
  entries.push({sourceCode:e.sourceCode,sourceName:e.sourceName,province:e.province,targetCode:e.targetCode,targetName:e.targetName,relation:'one-to-one',sourceHierarchy:row.hierarchy});
 }
 const p={...set,...binding,id:binding.tableId+'-'+input.statYear+'-'+level,level,itemId:binding.items.join('|'),reviewState:'verified',boundarySha256:set.boundaryHashes[level],sourceUrl:input.sourceUrl,evidence:'공식 원문 2-2 연계표의 코드와 실제 e-GIS 속성 전수 대조',entries,excludedRows};
 return {p,records,unit:binding.singleMetric?.unit||binding.unit||input.unit};
}
function convert(input,registry,refs,settings,boundaryHash){
 const stop=(type,message)=>blocked(input,settings,type,message);
 if(!input)return stop('원본 정보 없음','통계표·코드체계를 확인할 수 없습니다. KOSIS 원본 XLSX를 코드 포함으로 내려받아 넣어 주세요.');
 if(!settings.unitConfirmed||!['sido','sgg'].includes(settings.targetUnit)||settings.targetUnit!==settings.confirmedUnit)return stop('지역 단위 확인','원본과 같은 지도 단위를 선택하고 확인해 주세요.');
 if(settings.customReference||Object.keys(settings.fixes||{}).length||settings.aggregation!=='none')return stop('지원하지 않는 변환','검증된 경계에서 원본 값을 그대로 연결합니다. 지역 직접 변경·행 제외·집계는 사용할 수 없습니다.');
 if(settings.period!==input.statYear||settings.code!==0||settings.name!==1||settings.sido!==2||settings.year!==3)return stop('원본 설정 불일치','원본 코드·지역명·시도·연도 열을 변경할 수 없습니다.');
 const metrics=(settings.metrics||[]).map(c=>input.metrics.find(m=>m.column===c));
 if(!metrics.length||metrics.some(m=>!m))return stop('항목 확인','원본의 통계 항목을 하나 이상 선택하세요.');
 const standard=standardProfile(input,registry,settings.targetUnit);
 if(standard?.error)return stop('지역 분류 확인',standard.error);
 const profiles=standard?[standard.p]:(registry?.profiles||[]).filter(p=>p.orgId===input.orgId&&p.tableId===input.tableId&&p.statYear===input.statYear&&p.level===settings.targetUnit&&p.dimension===input.dimension);
 if(profiles.length!==1)return stop('미지원 통계표','이 통계표·연도·지역 단계의 코드 대응이 아직 검증되지 않았습니다. 원본을 보존했습니다. DETAIL에서 검증 상태를 확인하세요.');
 const p=profiles[0];
 if(!Array.isArray(refs?.[p.level]))return stop('경계 정보 없음','지도 지역 기준표를 불러오지 못했어요. 새로고침한 뒤 다시 시도해 주세요.');
 if(metrics.some(m=>!p.items?.includes(m.id)))return stop('미지원 통계 항목','선택한 항목은 아직 검증되지 않았어요. 비율·주지표 하나만 선택해서 다시 변환해 주세요.');
 if(standard&&metrics.some(m=>norm(m.label)!==norm(p.itemDefinitions?.[m.id]?.label)))return stop('항목 설명 불일치','통계 항목 코드와 설명이 검증된 원본과 달라요. KOSIS 원본과 선택한 지표를 확인해 주세요.');
 if(standard&&!p.singleMetric&&input.metrics.length===1&&input.unit&&norm(input.unit)!==norm(p.unit))return stop('단위 불일치','원본의 통계 단위가 검증된 지표와 달라요. 원본을 다시 확인해 주세요.');
 const boundaries=refs[p.level].map(r=>({code:r.code,name:r.name,province:r.sido_name,year:r.base_year,level:p.level}));
 let targets=refs[p.level].filter(r=>settings.scope==='all'||settings.scope==='sample'||r.sido===settings.scope);
 if(settings.scope==='sample'){
  const codes=settings.selectedCodes;
  if(!Array.isArray(codes)||!codes.length||new Set(codes).size!==codes.length||codes.some(c=>!targets.some(t=>t.code===c)))return stop('선택 지역 확인','일부 지역을 비교할 때는 지도에 표시할 지역을 직접 선택하세요.');
  targets=targets.filter(r=>codes.includes(r.code));
 }
 const selected=new Set(targets.map(t=>t.code)),allEntries=new Map((p.entries||[]).map(e=>[e.sourceCode,e]));
 const sourceRows=[],seenSources=new Set();let outside=0;
 for(const r of standard?.records||input.records){
  if(seenSources.has(r.sourceCode))return stop('원본 중복 코드','선택 범위와 관계없이 같은 원본 코드가 여러 행에 있습니다.');
  seenSources.add(r.sourceCode);
  const e=allEntries.get(r.sourceCode);
  // Only explicitly registered rows can be omitted. Unknowns are never name-filtered away.
  if(e&&!selected.has(e.targetCode)){
   if(r.year!==input.statYear||r.name!==e.sourceName||r.province!==e.province||JSON.stringify(r.hierarchy)!==JSON.stringify(e.sourceHierarchy))return stop('범위 밖 원본 불일치','제외할 지역도 코드·지역명·상위 시도·연도가 검증된 대응표와 같아야 합니다.');
   outside++;continue;
  }
  const ignored=(p.excludedRows||[]).some(x=>x.sourceCode===r.sourceCode&&x.name===r.name&&JSON.stringify(x.hierarchy)===JSON.stringify(r.hierarchy));
  if(ignored){outside++;continue;}
  sourceRows.push({...r,level:p.level});
 }
 const resolved=R.resolveBatch({registry:standard?{...registry,profiles:[p]}:registry,profileId:p.id,context:{orgId:input.orgId,tableId:input.tableId,itemId:p.itemId,statYear:input.statYear,statDate:p.statDate,boundaryYear:p.boundaryYear,codeSystem:p.codeSystem,level:p.level},rows:sourceRows,boundaries,expectedCodes:targets.map(t=>t.code),boundaryHash});
 if(resolved.status!=='지역 대응 완료'){const r=stop('코드 대응 중단',resolved.issues[0]?.detail||'공식 코드 대응 근거를 확인하세요.');r.issues=resolved.issues;r.crosswalk=resolved;return r;}
 const output=[],audit=[],issues=[];
 for(const r of resolved.output){
  // e-GIS uses parseFloat for CSV strings: numeric-leading descriptions ("1인가구",
  // "2024-12-31") otherwise silently become 1 / 2024. Label metadata explicitly.
  const target=targets.find(t=>t.code===r.code),out={...target,kosis_source_code:r.sourceCode,stat_year:input.statYear,stat_title:input.title?'통계표: '+input.title:'',unit:standard?.unit||input.unit||'',source_url:input.sourceUrl||'',classification_date:p.statDate?'KSSC 기준 '+p.statDate:'',code_system:p.codeSystem};
  for(const m of metrics){const raw=r.values[input.metrics.indexOf(m)],n=C.number(raw);if(n.kind!=='number')issues.push({row:r.sourceRow,type:n.kind==='missing'?'결측값':'수치 오류',detail:m.label,code:r.sourceCode});out[m.id]=n.value;audit.push({source_row:r.sourceRow,source_code:r.sourceCode,gis_code:r.code,name:r.name,metric:m.id,original_value:raw,output_value:n.value,comparison:n.kind==='number'?'일치':'미변환'});}
  output.push(out);
 }
 if(issues.length){const r=stop('통계값 확인','선택 지역에 결측값 또는 수치 오류가 있습니다. 0으로 바꾸지 않습니다.');r.issues=issues;r.audit=audit;return r;}
 return {output,headers:['code','name','sido','sido_name','base_year','kosis_source_code','stat_year','stat_title','unit','source_url','classification_date','code_system',...metrics.map(m=>m.id)],audit,issues:[],crosswalk:{profileId:p.id,registryVersion:registry.version,audit:resolved.audit},spatial:{sourceUnit:p.level,targetUnit:p.level},summary:{status:'결합 가능',input:input.records.length,matched:output.length,duplicates:0,aggregate:0,unmatched:0,missing:[],empty:0,outside,scope:settings.scope,period:input.statYear,expected:targets.length,boundaryWarning:input.statYear!==p.boundaryYear}};
}
const api={read,convert,blocked,sheetRows};if(typeof module==='object')module.exports=api;else root.KosisWorkbook=api;
})(globalThis);
