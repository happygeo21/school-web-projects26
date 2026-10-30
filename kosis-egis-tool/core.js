/* Shared pure conversion engine: browser and Node use the same implementation. */
(function(root){
'use strict';
const clean=v=>String(v??'').trim().normalize('NFC'), norm=v=>clean(v).replace(/\s+/g,'');
const aliases={'서울':'서울특별시','부산':'부산광역시','대구':'대구광역시','인천':'인천광역시','광주':'광주광역시','대전':'대전광역시','울산':'울산광역시','세종':'세종특별자치시','경기':'경기도','강원':'강원특별자치도','강원도':'강원특별자치도','충북':'충청북도','충남':'충청남도','전남':'전라남도','전북':'전북특별자치도','전라북도':'전북특별자치도','경북':'경상북도','경남':'경상남도','제주':'제주특별자치도'};
const province=v=>aliases[clean(v)]||clean(v);
// Narrow, table-scoped crosswalk supplied by the user; not a national code conversion.
const sourceProfiles={
 population_2024:{orgId:'101',tableId:'DT_1B040A3',itemId:'T20',sourceCode:'46790'},
 aging_2024:{orgId:'101',tableId:'DT_1YL20631',itemId:'T10',sourceCode:'1236370'},
 business_2024:{orgId:'118',tableId:'DT_118N_SAUPM78',itemId:'16118ED_1',sourceCode:'2017zone_3637',industry:'INDUSTRY_11S0',size:'15118SIZES_0700'}
};
function reviewSourceRegion({sourceCode,name,sido,period,selectedPeriod,profile,metadata={}}){
 const code=clean(sourceCode),n=norm(name),p=sourceProfiles[profile];
 if(code==='12760'&&(n==='화순군'||profile==='population_2024'))return {applies:true,allowed:false,reason:'12760은 화순군 이름 검색 후보일 뿐 검증된 2024년 결합코드가 아닙니다.'};
 const foreign=['1236370','2017zone_3637'].includes(code);
 if(!foreign&&!(p&&(n==='화순군'||code==='46790')))return {applies:false};
 if(!p)return {applies:true,allowed:false,reason:'원본 통계표를 선택하세요. 이름만으로 서로 다른 코드체계를 연결하지 않습니다.'};
 const same=Object.entries(p).filter(([k])=>k!=='sourceCode').every(([k,v])=>!clean(metadata[k])||clean(metadata[k])===v);
 if(!same||code!==p.sourceCode||n!=='화순군'||province(sido)!=='전라남도'||clean(period)!=='2024'||clean(selectedPeriod)!=='2024')return {applies:true,allowed:false,reason:'화순군 기준의 원본표·항목·코드·전라남도·2024년을 함께 확인하세요.'};
 return {applies:true,allowed:true,targetCode:'46790',reason:'사용자 외부 조회 기준으로 확인한 화순군 2024년 한 지역 교차표'};
}
function validateReference(ref){
 if(!ref.length)throw Error('기준표가 비어 있습니다.');
 const codes=new Set(),pairs=new Set();
 for(const r of ref){if(!/^\d{5}$/.test(r.code)||!/^\d{2}$/.test(r.sido)||!r.code.startsWith(r.sido)||!clean(r.name)||!clean(r.sido_name)||!/^\d{4}$/.test(r.base_year))throw Error('기준표 형식 오류: '+r.code);
 const pair=r.sido_name+'|'+norm(r.name);if(codes.has(r.code)||pairs.has(pair))throw Error('기준표 중복: '+r.code);codes.add(r.code);pairs.add(pair);}
 return ref;
}
function parseDelimited(text){
 text=text.replace(/^\uFEFF/,'');let q=false,commas=0,tabs=0;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"')i++;else q=!q;}else if(!q){if(c==='\n'||c==='\r')break;if(c===',')commas++;if(c==='\t')tabs++;}}
 const delimiter=tabs>commas?'\t':',';let rows=[],row=[],value='';q=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"')q=false;else value+=c;}else if(c==='"'){if(value)throw Error('따옴표 앞 문자를 확인하세요.');q=true;}else if(c===delimiter){row.push(value);value='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>clean(x)))rows.push(row);row=[];value='';}else value+=c;}
 if(q)throw Error('닫히지 않은 인용부호가 있습니다.');row.push(value);if(row.some(x=>clean(x)))rows.push(row);return rows;
}
function decode(buffer){try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{return new TextDecoder('euc-kr',{fatal:true}).decode(buffer);}}
function number(v){const s=clean(v);if(!s||/^(?:[-–—]|\.\.|…|N\/A|NA|X|\*)$/i.test(s))return {value:'',kind:'missing'};
 if(!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+|\d*\.\d+)(?:\.\d+)?%?$/.test(s))return {value:'',kind:'invalid'};
 const n=Number(s.replace(/,/g,'').replace(/%$/,''));return Number.isFinite(n)&&Math.abs(n)<=Number.MAX_SAFE_INTEGER?{value:n,kind:'number'}:{value:'',kind:'invalid'};
}
function expand(rows,merges=[]){const out=rows.map(r=>r.slice());for(const m of merges){if((m.e.r-m.s.r+1)*(m.e.c-m.s.c+1)>100000)throw Error('병합 범위가 너무 큽니다.');for(let r=m.s.r;r<=m.e.r;r++){out[r]??=[];for(let c=m.s.c;c<=m.e.c;c++)if(!clean(out[r][c]))out[r][c]=out[m.s.r]?.[m.s.c]??'';}}return out;}
function structure(rows,merges=[],settings={}){
 const src=expand(rows,merges);let start=settings.start;
 if(start===undefined){start=src.slice(0,30).findIndex(r=>r.some(v=>/지역명|행정구역|시군구|C1_NM|^name$|^code$/.test(clean(v))));if(start<0)start=0;}
 const depth=settings.depth||1;if(start<0||start+depth>src.length)throw Error('헤더 시작 행과 줄 수를 확인하세요.');
 const width=src.reduce((max,r)=>Math.max(max,r.length),0);if(width>500)throw Error('열이 500개를 초과합니다. 필요한 열만 남기세요.');
 const seen=new Set(),headers=Array.from({length:width},(_,c)=>{const h=[...new Set(src.slice(start,start+depth).map(r=>clean(r[c])).filter(Boolean))].join(' / ')||'열'+(c+1);let key=h,n=2;while(seen.has(key))key=h+' ('+(n++)+')';seen.add(key);return key;});
 const find=re=>headers.findIndex(h=>re.test(h));
 return {src,headers,start,depth,dataStart:start+depth,name:headers.findIndex(h=>/지역명|행정구역|시군구|C1_NM|^name$/i.test(h)&&!/코드|code/i.test(h)),code:find(/code|코드|^C1$/i),sido:find(/시도명|sido_name/i),year:find(/통계연도|^연도$|시점|^year$|PRD_DE/i)};
}
function convert(ref,a,settings){
 validateReference(ref);const metrics=settings.metrics||[];if(!metrics.length)throw Error('지도에 나타낼 통계 열을 하나 이상 선택하세요.');
 const name=settings.name??a.name,code=settings.code??a.code,sido=settings.sido??a.sido,year=settings.year??a.year;
 if(name<0&&code<0)throw Error('지역명 열 또는 5자리 시군구 코드 열을 선택하세요.');
 const scope=settings.scope||'all',target=scope==='sample'?ref:ref.filter(r=>scope==='all'||r.sido===scope);if(!target.length)throw Error('분석 범위에 해당하는 기준 지역이 없습니다.');
 const byCode=new Map(ref.map(r=>[r.code,r])),provinces=new Set(ref.map(r=>r.sido_name)),issues=[],groups=new Map(),years=new Set();let context='',parent='',input=0,aggregate=0,unmatched=0,outside=0;
 const provinceTokens=[...provinces,...Object.keys(aliases)].sort((x,y)=>y.length-x.length);
 const names=new Map(),pairs=new Map(),targetCodes=new Set(target.map(r=>r.code));for(const r of ref){const k=norm(r.name);if(!names.has(k))names.set(k,[]);names.get(k).push(r);pairs.set(r.sido_name+'|'+k,r);}
 const sourceColumn=code>=0?code:a.code,headerYears=[...new Set(a.headers.flatMap(h=>h.match(/(?:19|20)\d{2}/g)||[]))];
 const metaColumn=patterns=>a.headers.findIndex(h=>patterns.test(h));const metaCols={orgId:metaColumn(/^(orgId|ORG_ID)$/i),tableId:metaColumn(/^(tableId|tblId|TBL_ID)$/i),itemId:metaColumn(/^(itemId|itmId|ITM_ID)$/i),industry:metaColumn(/^(industry|산업코드|C2)$/i),size:metaColumn(/^(size|규모코드|C3)$/i)};
 const fixes=settings.fixes||{}, metricHeaders=metrics.map(i=>['code','name','sido','sido_name','base_year'].includes(a.headers[i])?'통계_'+a.headers[i]:a.headers[i]);
 for(let n=a.dataStart;n<a.src.length;n++){
 const row=a.src[n];if(row.every(v=>!clean(v)))continue;input++;const rowNo=n+1,raw=clean(row[name]),rawCode=clean(row[sourceColumn]);let region=raw,explicit=province(row[sido]),p='';
 for(const token of provinceTokens){if(region===token||region.startsWith(token+' ')){p=province(token);region=region.slice(token.length).trim();break;}}
 const issue=(type,detail)=>issues.push({row:rowNo,type,region:raw,code:rawCode,detail});
 if(explicit&&!provinces.has(explicit)){issue('시도 오류','시도명 열을 확인하세요.');unmatched++;continue;}
 if(p&&explicit&&p!==explicit){issue('시도 불일치','지역명과 시도 열이 다릅니다.');unmatched++;continue;}
 if(p||explicit){const next=p||explicit;if(next!==context)parent='';context=next;}
 if(year>=0&&clean(row[year]))years.add(clean(row[year]));
 const fixed=fixes[rowNo];if(fixed==='skip'){issue('수동 제외','사용자가 제외한 원본행');continue;}
 const metadata=Object.fromEntries(Object.entries(metaCols).map(([k,c])=>[k,c>=0?row[c]:'']));
 const profile=settings.sourceProfile||Object.keys(sourceProfiles).find(key=>Object.entries(sourceProfiles[key]).filter(([k])=>k!=='sourceCode').every(([k,v])=>clean(metadata[k])===v))||'';
 const sourceYear=year>=0?clean(row[year]):headerYears.length===1?headerYears[0]:'';
 const guard=reviewSourceRegion({sourceCode:rawCode,name:region,sido:explicit||p,period:sourceYear,selectedPeriod:settings.period,profile,metadata});
 if(guard.applies&&(!guard.allowed||(fixed&&fixed!==guard.targetCode))){issue('원본 불일치',guard.reason);unmatched++;continue;}
 let match=guard.allowed?byCode.get(guard.targetCode):null;
 if(guard.allowed)issue('원본 코드 교차표',rawCode+' → '+guard.targetCode+' / '+profile+' / 사용자 제공 기준, 전남 전수검증 아님');
 if(!fixed&&!rawCode&&(!region||/^(전국|합계|총계|소계|계)$/.test(region))){
  if(context==='세종특별자치시'&&raw!=='전국')match=ref.find(r=>r.sido_name===context);else{aggregate++;issue('합계행','지도 결합에서 제외');continue;}
 }
 const candidates=region?(names.get(norm(region))||[]).filter(r=>!context||r.sido_name===context):[];
 if(!guard.allowed&&fixed){issue('수동 지정','사용자가 기준 지역 '+fixed+' 선택');match=byCode.get(fixed);if(!match){issue('수동 코드 오류','기준표에서 다시 선택하세요.');unmatched++;continue;}}
 else if(!guard.allowed&&rawCode){match=byCode.get(rawCode);if(!match|| (context&&match.sido_name!==context)|| (region&&norm(region)!==norm(match.name)&&!(parent&&norm(parent+region)===norm(match.name)))){issue('코드·이름 불일치','원본 코드·시도·이름을 확인하세요. 다른 코드체계는 검증된 교차표 없이 이름만으로 연결하지 않습니다.');unmatched++;continue;}}
 else if(!match){
  if(candidates.length===1)match=candidates[0];
  else if(context&&parent){match=pairs.get(context+'|'+norm(parent+region))||null;}
  if(!match&&context&&ref.some(r=>r.sido_name===context&&norm(r.name).startsWith(norm(region))&&r.name!==region&&/시$/.test(region))){parent=region;aggregate++;issue('상위 시 합계','하위 구에 값을 복제하지 않습니다.');continue;}
  if(!match){issue(candidates.length>1?'동명이 지역':'미매칭','시도명을 별도 열에 넣거나 전체 지역명을 입력하세요.');unmatched++;continue;}
 }
 // Unique names must never silently establish province context for later ambiguous names.
 if(parent&&!norm(match.name).startsWith(norm(parent)))parent='';
 if(scope!=='sample'&&!targetCodes.has(match.code)){outside++;issue('범위 밖','선택한 분석 범위에서 제외');continue;}
 const values=metrics.map(i=>number(row[i]));values.forEach((v,j)=>{if(v.kind!=='number')issue(v.kind==='missing'?'결측':'수치 오류',a.headers[metrics[j]]+': '+clean(row[metrics[j]]));});
 const hit={row:rowNo,match,values};if(!groups.has(match.code))groups.set(match.code,[]);groups.get(match.code).push(hit);
 }
 let duplicates=0;for(const [key,hits] of groups)if(hits.length>1){duplicates++;for(const h of hits)issues.push({row:h.row,type:'중복 지역',region:h.match.name,code:key,detail:'연도·지표·성별을 하나로 선택하세요. 모든 중복값은 비웁니다.'});}
 const outputRefs=scope==='sample'?ref.filter(r=>groups.has(r.code)):target;
 const output=outputRefs.map(r=>{const hits=groups.get(r.code),hit=hits?.length===1?hits[0]:null;return {...r,...Object.fromEntries(metricHeaders.map((h,j)=>[h,hit?hit.values[j].value:'']))};});
 const outputByCode=new Map(output.map(r=>[r.code,r])),audit=[];
 for(const [key,hits] of groups)for(const hit of hits)metrics.forEach((column,j)=>{const original=a.src[hit.row-1]?.[column]??'',value=outputByCode.get(key)?.[metricHeaders[j]];audit.push({source_row:hit.row,source_code:sourceColumn>=0?clean(a.src[hit.row-1]?.[sourceColumn]):'',gis_code:key,name:hit.match.name,metric:metricHeaders[j],original_value:original,normalized_value:hit.values[j].value,output_value:value,value_kind:hit.values[j].kind,comparison:hits.length>1?'중복 미비교':hit.values[j].kind==='invalid'?'수치 오류':value===hit.values[j].value?'일치':'불일치'});});
 const matched=[...groups.values()].filter(h=>h.length===1).length,missing=outputRefs.filter(r=>!groups.has(r.code)).map(r=>r.code),empty=output.filter(r=>metricHeaders.some(h=>r[h]==='')).length;
 const period=settings.period||'',periods=[...years];const boundaryWarning=!period||ref.some(r=>r.base_year!==period)||periods.some(y=>y!==period);
 const stopped=!matched||duplicates>0||periods.length>1||issues.some(x=>/불일치|수치 오류|시도 오류|수동 코드 오류/.test(x.type));
 const status=stopped?'결합 중단':unmatched||missing.length||empty||outside||boundaryWarning||issues.some(x=>/^수동/.test(x.type))||scope==='sample'?'확인 필요':'결합 가능';
 return {output,audit,headers:['code','name','sido','sido_name','base_year',...metricHeaders],issues,summary:{status,input,matched,duplicates,aggregate,unmatched,missing,empty,outside,scope,period,periods,boundaryWarning,referenceCount:ref.length,expected:scope==='sample'?null:target.length}};
}
function csv(rows,headers){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+[headers.map(q).join(','),...rows.map(r=>headers.map(h=>q(r[h])).join(','))].join('\r\n');}
const api={sourceProfiles,reviewSourceRegion,clean,norm,province,validateReference,parseDelimited,decode,number,expand,structure,convert,csv};if(typeof module!=='undefined')module.exports=api;else root.KosisCore=api;
})(globalThis);
