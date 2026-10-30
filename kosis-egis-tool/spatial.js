/* Spatial dispatch is separate from the existing, regression-tested SGG engine. */
(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.KosisCore;
const clean=C.clean,norm=C.norm;
function validateSido(ref){
 if(!Array.isArray(ref)||ref.length!==17)throw Error('시도 기준표는 검증한 2025년 17개 원본이어야 합니다.');
 const codes=new Set(),names=new Set();
 for(const r of ref){if(!/^\d{2}$/.test(r.code)||r.sido!==r.code||r.name!==r.sido_name||!/^\d{4}$/.test(r.base_year)||!r.name||codes.has(r.code)||names.has(r.name))throw Error('시도 기준표의 코드·이름·연도·중복을 확인하세요.');codes.add(r.code);names.add(r.name);}
 return ref;
}
function context(refs){
 const sido=validateSido(refs.sido),sgg=C.validateReference(refs.sgg),provinceNames=new Set(sido.map(r=>r.name)),parents=new Map();
 for(const r of sgg){const m=r.name.match(/^(.+?시)(.+구)$/);if(!m)continue;const key=r.sido+'|'+norm(m[1]);if(!parents.has(key))parents.set(key,{name:m[1],sido:r.sido,sido_name:r.sido_name,children:[]});parents.get(key).children.push(r);}
 for(const p of parents.values()){const prefixes=new Set(p.children.map(r=>r.code.slice(0,4)));p.code=prefixes.size===1?[...prefixes][0]+'0':null;}
 const byName=new Map(),byCode=new Map(),parentsByName=new Map();for(const r of sgg){const k=norm(r.name);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(r);byCode.set(r.code,r);}for(const p of parents.values()){const k=norm(p.name);if(!parentsByName.has(k))parentsByName.set(k,[]);parentsByName.get(k).push(p);}
 const provinceByName=new Map(sido.map(r=>[r.name,r])),provinceTokens=[...provinceNames,...['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','강원도','충북','충남','전북','전라북도','전남','경북','경남','제주']].sort((a,b)=>b.length-a.length);
 return {sido,sgg,provinceNames,parents,byName,byCode,parentsByName,provinceByName,provinceTokens};
}
function rowRegion(row,a,settings,ctx){
 const ni=settings.name??a.name,ci=settings.code??a.code,si=settings.sido??a.sido;
 const sourceColumn=ci>=0?ci:a.code,code=sourceColumn>=0?clean(row[sourceColumn]):'';
 let name=clean(row[ni]),sido=C.province(row[si]);
 for(const alias of ctx.provinceTokens)if(name.startsWith(alias+' ')){if(!sido)sido=C.province(alias);name=name.slice(alias.length).trim();break;}
 const province=ctx.provinceByName.get(C.province(name));
 if(province)return {unit:'sido',name:province.name,code,sido:province.name,province};
 if(/^(전국|합계|총계|소계|계)$/.test(name))return {unit:'total',name,code,sido};
 const matches=[...new Set([...(ctx.byName.get(norm(name))||[]),ctx.byCode.get(code)].filter(Boolean))].filter(r=>!sido||r.sido_name===sido);
 if(matches.length||/구$|군$/.test(name))return {unit:'sgg',name,code,sido,matches};
 const parent=(ctx.parentsByName.get(norm(name))||[]).find(p=>!sido||p.sido_name===sido);
 if(parent)return {unit:'city',name,code,sido,parent};
 if(!name&&ctx.sido.some(r=>r.code===code))return {unit:'sido',name:'',code,sido,province:ctx.sido.find(r=>r.code===code)};
 if(!name&&ctx.sgg.some(r=>r.code===code))return {unit:'sgg',name:'',code,sido};
 return {unit:'unknown',name,code,sido};
}
function detect(refs,a,settings={}){
 const ctx=context(refs),counts={sido:0,sgg:0,city:0,total:0,unknown:0},provinceSet=new Set(),evidence=[];
 for(let i=a.dataStart;i<a.src.length;i++){const row=a.src[i];if(row.every(v=>!clean(v)))continue;const r=rowRegion(row,a,settings,ctx);counts[r.unit]++;if(r.sido)provinceSet.add(r.sido);if(r.matches?.length===1)provinceSet.add(r.matches[0].sido_name);if(r.province)provinceSet.add(r.province.name);if(evidence.length<12)evidence.push({row:i+1,unit:r.unit,name:r.name,source_code:r.code});}
 let unit=counts.sgg?'sgg':counts.city?'city':counts.sido?'sido':'unknown';
 // A blank region row or title alone never proves a spatial unit.
 const confidence=unit==='unknown'?'uncertain':counts.unknown?'review':'clear';
 const suggestedProvince=provinceSet.size===1?ctx.sido.find(r=>r.name===[...provinceSet][0])?.code:null;
 const titleHint=/시군구|시·군·구/.test(settings.title||'')?'sgg':/시도|시·도/.test(settings.title||'')?'sido':null;
 return {unit,confidence,titleHint,counts,evidence,suggestedProvince,requiresConfirmation:true,title:settings.title||'',period:settings.period||'',note:unit==='city'?'상위 시 합계 자료는 일반구가 포함된 252개 경계와 다를 수 있습니다.':counts.sido&&counts.sgg?'시군구 행과 상위 시도 행이 함께 있습니다. 합계 중복을 확인하세요.':'추정은 지역명·코드·시도 열의 근거이며 학생 확인이 필요합니다.'};
}
function headersFor(metrics,a){const used=new Set(['code','name','sido','sido_name','base_year']);return metrics.map(i=>{let h=a.headers[i]||'통계값';if(used.has(h))h='통계_'+h;while(used.has(h))h+=' (통계)';used.add(h);return h;});}
function blocked(refs,a,settings,detection,reason){return {output:[],headers:['code','name','sido','sido_name','base_year'],audit:[],issues:[{row:0,type:'공간 단위 불일치',region:'',code:'',detail:reason}],spatial:{sourceUnit:detection.unit,targetUnit:settings.targetUnit||'sgg',detection,blocked:true,reason,originalPreserved:true},summary:{status:'결합 중단',input:a.src.slice(a.dataStart).filter(r=>r.some(v=>clean(v))).length,matched:0,duplicates:0,aggregate:0,unmatched:0,missing:[],empty:0,outside:0,scope:settings.scope||'all',period:settings.period||'',periods:[],boundaryWarning:false,referenceCount:settings.targetUnit==='sido'?17:refs.sgg.length,expected:null}};}
function convertSido(refs,a,settings,detection){
 const ctx=context(refs),metrics=settings.metrics||[];if(!metrics.length)throw Error('통계 열을 하나 이상 선택하세요.');
 const metricHeads=headersFor(metrics,a),target=ctx.sido.filter(r=>!settings.scope||['all','sample'].includes(settings.scope)||r.code===settings.scope),groups=new Map(),issues=[],audit=[],years=new Set();let input=0,aggregate=0,unmatched=0,outside=0;
 for(let i=a.dataStart;i<a.src.length;i++){const row=a.src[i];if(row.every(v=>!clean(v)))continue;input++;const r=rowRegion(row,a,settings,ctx),yearCol=settings.year??a.year;
 if(yearCol>=0&&clean(row[yearCol]))years.add(clean(row[yearCol]));
 if(r.unit==='total'){aggregate++;issues.push({row:i+1,type:'합계행',detail:'전국 합계 제외',region:r.name,code:r.code});continue;}
 if(r.unit!=='sido'||!r.province){unmatched++;issues.push({row:i+1,type:'공간 단위 불일치',region:r.name,code:r.code,detail:'시군구 행을 시도 행처럼 직접 결합하지 않습니다.'});continue;}
 const p=r.province,explicit=C.province(row[settings.sido??a.sido]);
 // Only the actual two-digit key or its verified five-digit padded form is accepted.
 if((!r.name&&!explicit)||(r.code&&r.code!==p.code&&r.code!==p.code+'000')||(explicit&&explicit!==p.name)){unmatched++;issues.push({row:i+1,type:'코드·이름 불일치',region:r.name,code:r.code,detail:'시도 코드체계와 이름을 확인하세요. 이름만으로 다른 코드를 바꾸지 않습니다.'});continue;}
 if(!target.some(t=>t.code===p.code)){outside++;continue;}
 const values=metrics.map(c=>C.number(row[c]));values.forEach((v,j)=>{if(v.kind!=='number')issues.push({row:i+1,type:v.kind==='missing'?'결측':'수치 오류',region:p.name,code:p.code,detail:metricHeads[j]});});
 if(!groups.has(p.code))groups.set(p.code,[]);groups.get(p.code).push({row:i+1,values,raw:row,sourceCode:r.code});
 }
 let duplicates=0;for(const [code,hits] of groups)if(hits.length>1){duplicates++;issues.push({row:hits[0].row,type:'중복 지역',region:code,code,detail:'시도별로 한 연도·한 항목만 남기세요.'});}
 const output=(settings.scope==='sample'?target.filter(r=>groups.has(r.code)):target).map(p=>{const h=groups.get(p.code),one=h?.length===1?h[0]:null;return {...p,...Object.fromEntries(metricHeads.map((m,j)=>[m,one?one.values[j].value:'']))};});
 const out=new Map(output.map(r=>[r.code,r]));for(const [code,hits] of groups)for(const h of hits)metrics.forEach((c,j)=>audit.push({source_row:h.row,source_code:h.sourceCode,gis_code:code,name:out.get(code).name,metric:metricHeads[j],original_value:h.raw[c],normalized_value:h.values[j].value,output_value:out.get(code)[metricHeads[j]],value_kind:h.values[j].kind,comparison:hits.length>1?'중복 미비교':h.values[j].kind==='invalid'?'수치 오류':'일치'}));
 const missing=target.filter(r=>!groups.has(r.code)).map(r=>r.code),empty=output.filter(r=>metricHeads.some(h=>r[h]==='')).length,matched=[...groups.values()].filter(h=>h.length===1).length,boundaryWarning=!settings.period||target.some(r=>r.base_year!==settings.period)||[...years].some(y=>y!==settings.period);
 const status=duplicates||!matched||unmatched||years.size>1||issues.some(i=>/수치 오류|불일치/.test(i.type))?'결합 중단':missing.length||empty||outside||boundaryWarning||settings.scope==='sample'?'확인 필요':'결합 가능';
 return {output,headers:['code','name','sido','sido_name','base_year',...metricHeads],audit,issues,spatial:{sourceUnit:'sido',targetUnit:'sido',detection},summary:{status,input,matched,duplicates,aggregate,unmatched,missing,empty,outside,scope:settings.scope||'all',period:settings.period||'',periods:[...years],boundaryWarning,referenceCount:17,expected:settings.scope==='sample'?null:target.length}};
}
function prepareSgg(refs,a,settings){
 const ctx=context(refs),src=a.src.map(r=>r.slice()),codeCol=(settings.code??a.code)>=0?(settings.code??a.code):a.code,totals=[];
 for(let i=a.dataStart;i<src.length;i++){const r=rowRegion(src[i],a,settings,ctx);
  if(r.unit==='sido'&&r.province&&(!r.code||r.code===r.province.code||r.code===r.province.code+'000')){totals.push({row:i+1,province:r.province.code,original:a.src[i]});if(codeCol>=0)src[i][codeCol]='';}
  if(r.unit==='total'&&['','00','00000'].includes(r.code)&&codeCol>=0)src[i][codeCol]='';
  if(r.unit==='city'&&r.parent&&(!r.code||r.code===r.parent.code)&&codeCol>=0)src[i][codeCol]='';
 }
 return {analysis:{...a,src},totals};
}
function aggregate(refs,a,settings,detection){
 const method=settings.aggregation||'none',metrics=settings.metrics||[];
 if(method==='none')return blocked(refs,a,settings,detection,'시군구 통계를 시도 지도에 붙이려면 집계 방식과 원자료를 먼저 확인하세요.');
 if(!['sum','ratio','density'].includes(method))return blocked(refs,a,settings,detection,'비율·평균을 단순 평균하지 않습니다. 분자·분모 또는 합산 가능한 원자료가 필요합니다.');
 if(!settings.additiveConfirmed)return blocked(refs,a,settings,detection,'서로 겹치지 않는 지역의 합산 가능한 원자료인지 확인해 주세요.');
 if(method==='sum'&&(settings.measure!=='count'||metrics.some(i=>/비율|율|평균|밀도|지수|%/.test(a.headers[i]||''))||a.src.slice(a.dataStart).some(r=>metrics.some(i=>/%\s*$/.test(clean(r[i]))))))return blocked(refs,a,settings,detection,'비율·평균·밀도는 합하거나 단순 평균할 수 없습니다. 인구수·시설수처럼 더해도 되는 수량만 합계합니다.');
 const numerator=Number(settings.numerator),denominator=Number(settings.denominator);
 if(method!=='sum'&&(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<0||denominator<0||numerator===denominator||!a.headers[numerator]||!a.headers[denominator]))return blocked(refs,a,settings,detection,'분자와 분모의 서로 다른 원자료 열을 선택하세요.');
 if(method==='density'&&(settings.areaUnit!=='km2'||/ha|헥타르|㎡|(?:^|[^k])m²/i.test(a.headers[denominator]||'')))return blocked(refs,a,settings,detection,'인구밀도 재산출에는 km² 단위 면적이 필요합니다. 단위를 확인하세요.');
 if(method!=='sum'&&([numerator,denominator].some(i=>/비율|율|평균|밀도|지수|%|\brate\b|\bmean\b|\baverage\b/i.test(a.headers[i]||''))||a.src.slice(a.dataStart).some(r=>[numerator,denominator].some(i=>/%\s*$/.test(clean(r[i]))))))return blocked(refs,a,settings,detection,'비율·평균 열을 분자·분모 수량처럼 사용할 수 없습니다. 실제 인원수와 전체 인구수 또는 인구수와 면적을 선택하세요.');
 const cols=method==='sum'?metrics:[numerator,denominator];if(!cols.length)throw Error('집계할 통계 열을 선택하세요.');
 const prep=prepareSgg(refs,a,settings),base=C.convert(refs.sgg,prep.analysis,{...settings,metrics:cols,scope:'all'}),scope=settings.scope||'all',provinces=refs.sido.filter(p=>['all','sample'].includes(scope)||p.code===scope),heads=base.headers.slice(5),outHeads=method==='sum'?heads: [method==='ratio'?'집계_비율(%)':'집계_인구밀도(명/km²)'],output=[],report=[],issues=[...base.issues];let validGroups=0,missingCodes=[],empty=0;
 for(const p of provinces){const expected=refs.sgg.filter(r=>r.sido===p.code),data=base.output.filter(r=>r.sido===p.code),missing=expected.filter(r=>!base.audit.some(x=>x.gis_code===r.code&&x.comparison==='일치')).map(r=>r.code),incomplete=missing.length||data.length!==expected.length||data.some(r=>heads.some(h=>r[h]===''))||base.summary.status==='결합 중단';missingCodes.push(...missing);const values=outHeads.map(()=> '');
  if(!incomplete){const sums=heads.map(h=>data.reduce((n,r)=>n+Number(r[h]),0));if(sums.some(x=>!Number.isFinite(x)||Math.abs(x)>Number.MAX_SAFE_INTEGER)){issues.push({row:0,type:'수치 오류',region:p.name,detail:'합계가 안전한 숫자 범위를 벗어났습니다.'});}
   else if(method==='sum'){values.splice(0,values.length,...sums);validGroups++;}
   else if(data.some(r=>Number(r[heads[0]])<0||Number(r[heads[1]])<=0||(method==='ratio'&&Number(r[heads[0]])>Number(r[heads[1]])))||sums[1]<=0){issues.push({row:0,type:'분모 오류',region:p.name,detail:'분모는 양수, 분자는 음수가 아니어야 합니다.'});}
   else {const calculated=sums[0]/sums[1]*(method==='ratio'?100:1);if(!Number.isFinite(calculated)||Math.abs(calculated)>Number.MAX_SAFE_INTEGER)issues.push({row:0,type:'수치 오류',region:p.name,detail:'계산값이 안전한 숫자 범위를 벗어났습니다.'});else {values[0]=calculated;validGroups++;}}
  }
  if(values.some(v=>v===''))empty++;
  const row={...p,...Object.fromEntries(outHeads.map((h,j)=>[h,values[j]]))};output.push(row);
  const comparisons=[];const totalCols=method==='sum'?cols:Number.isInteger(settings.originalTotalMetric)&&settings.originalTotalMetric>=0?[settings.originalTotalMetric]:[];
  for(const total of prep.totals.filter(t=>t.province===p.code))totalCols.forEach((c,j)=>{const v=C.number(total.original[c]),value=values[method==='sum'?j:0];if(v.kind==='number')comparisons.push({source_row:total.row,metric:a.headers[c],original:v.value,calculated:value,equal:value===''?null:Math.abs(v.value-value)<=1e-9,comparison:value===''?'자료 부족으로 미계산':'원본 표시값과 엄격 비교(반올림 차이도 확인)'});});
  if(comparisons.some(c=>c.equal===false))issues.push({row:0,type:'원본 시도합계 불일치',region:p.name,detail:'원본 시도 값과 계산값이 다릅니다. 반올림·지표 정의·집계 범위·누락을 확인하세요.'});
  report.push({province:p.code,name:p.name,method,formula:method==='sum'?'Σ 시군구 수량':method==='ratio'?'Σ 분자 ÷ Σ 분모 × 100':'Σ 인구 ÷ Σ 면적(km²)',expected_regions:expected.length,missing_codes:missing,complete:!incomplete,source_province_comparison:comparisons,scope,period:settings.period});
 }
 const stopped=!validGroups||base.summary.status==='결합 중단'||issues.some(i=>/불일치|오류/.test(i.type));
 return {output,headers:['code','name','sido','sido_name','base_year',...outHeads],audit:base.audit.map(x=>({...x,stage:'집계 전 시군구 원본값 대조',target_province:refs.sgg.find(r=>r.code===x.gis_code)?.sido,comparison:x.comparison==='일치'?'집계 전 시군구값 일치':x.comparison})),issues,aggregation:{method,measure:settings.measure,formula:report[0]?.formula,numerator:method==='sum'?null:a.headers[numerator],denominator:method==='sum'?null:a.headers[denominator],source_columns:cols.map(c=>a.headers[c]),additive_confirmed:!!settings.additiveConfirmed,report,source_scope:scope,period:settings.period,partial_sums_used:false},spatial:{sourceUnit:'sgg',targetUnit:'sido',detection,aggregated:true},summary:{...base.summary,status:stopped?'결합 중단':empty||missingCodes.length||base.summary.boundaryWarning?'확인 필요':'결합 가능',matched:validGroups,missing:missingCodes,empty,scope,referenceCount:17,expected:provinces.length}};
}
function convert(refs,a,settings={}){
 const detection=detect(refs,a,settings),source=settings.confirmedUnit||'',target=settings.targetUnit||'sgg';
 if(!source||!settings.unitConfirmed)return blocked(refs,a,settings,detection,'추정'+'한 지역 단위를 확인하고 선택해 주세요. 원본은 그대로 보존됩니다.');
 if(detection.unit==='city')return blocked(refs,a,settings,detection,'일반구가 없는 상위 시·군 자료입니다. 같은 시군 경계의 기준표를 넣거나 원래 시도 통계를 사용하세요. 일반구에 값을 복제하지 않습니다.');
 if(detection.unit!=='unknown'&&detection.unit!==source)return blocked(refs,a,settings,detection,'원본에서 확인한 지역 단계와 선택한 단계가 다릅니다. 자료와 지도 선택을 다시 확인하세요.');
 if(source==='sido'&&target==='sgg')return blocked(refs,a,settings,detection,'시도 통계를 시군구 전체에 복제하지 않습니다. 시도 지도로 바꾸면 원본 그대로 사용할 수 있어요.');
 if(source==='sgg'&&target==='sido')return aggregate(refs,a,settings,detection);
 if(source==='sido'&&target==='sido')return convertSido(refs,a,settings,detection);
 if(source!=='sgg'||target!=='sgg')return blocked(refs,a,settings,detection,'같은 공간 단위의 자료와 지도를 선택하세요.');
 const prep=prepareSgg(refs,a,settings),r=C.convert(refs.sgg,prep.analysis,settings);if(settings.customReference&&r.summary.status==='결합 가능')r.summary.status='확인 필요';r.spatial={sourceUnit:'sgg',targetUnit:'sgg',detection,province_totals:prep.totals.map(t=>({row:t.row,province:t.province}))};return r;
}
const api={validateSido,detect,convert,aggregate};if(typeof module!=='undefined')module.exports=api;else root.KosisSpatial=api;
})(globalThis);
