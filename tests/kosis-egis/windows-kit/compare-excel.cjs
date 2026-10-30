try {
// Compare ORIGINAL workbook against the converter's actually downloaded CSV. Does not reconvert it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),C=require('./core.js'),XLSX=require('./site/kosis-egis-tool/xlsx.full.min.js');
const [original,converted,configFile,outDir='excel-comparison']=process.argv.slice(2);
if(!original||!converted||!configFile){console.error('Usage: node compare-excel.cjs original.xlsx converted.csv config.json output-folder');process.exit(2);}
const cfg=JSON.parse(fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));
if(!/^\d{4}$/.test(cfg.period))throw Error('Set period to the actual four-digit year.');
if(!cfg.synthetic)for(const k of ['title','table_id','item','unit','reference_date','url','download_date'])if(!cfg.source?.[k]||String(cfg.source[k]).includes('REPLACE'))throw Error('Complete source.'+k);
if(!['GIS','SOURCE'].includes(cfg.code_system))throw Error('code_system must be GIS or SOURCE.');
const sourceBytes=fs.readFileSync(original),outputBytes=fs.readFileSync(converted);let raw,merges=[];
if(/\.(?:xlsx|xls)$/i.test(original)){const wb=XLSX.read(sourceBytes,{type:'buffer'});if(!cfg.sheet||!wb.Sheets[cfg.sheet])throw Error('Set sheet to an exact workbook sheet name: '+wb.SheetNames.join(', '));const ws=wb.Sheets[cfg.sheet];raw=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:'',blankrows:true});merges=ws['!merges']||[];}else raw=C.parseDelimited(C.decode(sourceBytes));
const a=C.structure(raw,merges,{start:(cfg.header_start||1)-1,depth:cfg.header_depth||1}),col=k=>a.headers.indexOf(cfg.columns[k]||'');
for(const k of ['name','value'])if(col(k)<0)throw Error('Missing source column '+k+'. Available: '+a.headers.join(' | '));
if(cfg.code_system==='GIS'&&col('code')<0)throw Error('GIS code mode requires a source code column.');

if(cfg.aggregation&&cfg.aggregation!=='none')throw Error('집계 결과는 지역별 직접 대조 대신 집계 보고서와 원본 시도값 비교로 확인하세요.');
const provincial=cfg.target_unit==='sido';
const layer=JSON.parse(fs.readFileSync(path.join(__dirname,provincial?'egis-sido-2025.geojson':'egis-sigungu.geojson'),'utf8')).features.map(f=>provincial?{...f.properties,sido:f.properties.code,sido_name:f.properties.name}:f.properties),byCode=new Map(layer.map(r=>[r.code,r]));
const csv=C.parseDelimited(C.decode(outputBytes)),headers=csv.shift();if(!headers||new Set(headers).size!==headers.length)throw Error('Empty or duplicate output headers.');
for(const h of ['code','name','sido','sido_name','base_year',cfg.output_value])if(!headers.includes(h))throw Error('Missing output column '+h);
const output=csv.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']))),outByCode=new Map(),problems=[],excluded=[],checks=[],sourceKeys=new Set();
const norm=x=>String(x??'').trim().replace(/\s+/g,'').normalize('NFC');
const numeric=x=>{const s=String(x??'').trim();if(/^(?:|-|–|—|\.\.|…|N\/A|NA|X|\*)$/i.test(s))return {valid:true,value:''};if(!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/.test(s)&&! /^[+-]?\.\d+%?$/.test(s))return {valid:false};const n=Number(s.replace(/,/g,'').replace(/%$/,''));return {valid:Number.isFinite(n)&&Math.abs(n)<=Number.MAX_SAFE_INTEGER,value:n};};
for(const r of output){if(outByCode.has(r.code))problems.push({type:'output duplicate',code:r.code});outByCode.set(r.code,r);const p=byCode.get(r.code);if(!p){problems.push({type:'output unknown GIS code',code:r.code});continue;}for(const field of ['name','sido','sido_name','base_year'])if(r[field]!==p[field])problems.push({type:'output metadata mismatch',code:r.code,field,expected:p[field],actual:r[field]});}
for(let i=a.dataStart;i<a.src.length;i++){
 const row=a.src[i];if(row.every(v=>!String(v??'').trim()))continue;const rowNo=i+1,omit=cfg.exclude_rows?.[rowNo];
 if(omit){if(typeof omit!=='string'||!omit.trim())throw Error('Every exclusion needs a reason.');excluded.push({row:rowNo,reason:omit,original:row});continue;}
 const originalName=String(row[col('name')]??'').trim(),sourceCode=String(row[col('code')]??'').trim();let name=originalName,sido=C.province(row[col('sido')]);
if(provincial)name=C.province(name);
const tokens=name.split(/\s+/);if(tokens.length>1&&layer.some(p=>p.sido_name===C.province(tokens[0]))){const embedded=C.province(tokens.shift());if(sido&&sido!==embedded){problems.push({type:'explicit province conflict',row:rowNo});continue;}sido=embedded;name=tokens.join(' ');}
const mapped=cfg.row_regions?.[rowNo];if(mapped&&(!mapped.reason||mapped.original_name!==originalName||!byCode.has(mapped.code)))throw Error('Invalid reviewed row_regions entry at row '+rowNo);
 const readMeta=(re,fallback)=>{const i=a.headers.findIndex(h=>re.test(h));return i>=0?row[i]:fallback;};
 const headerYears=[...new Set(a.headers.flatMap(h=>h.match(/(?:19|20)\d{2}/g)||[]))];
 const guard=C.reviewSourceRegion({sourceCode,name,sido,period:col('year')>=0?row[col('year')]:headerYears.length===1?headerYears[0]:'',selectedPeriod:cfg.period,profile:cfg.source_profile||'',metadata:{orgId:readMeta(/^(orgId|ORG_ID)$/i,cfg.source?.org_id),tableId:readMeta(/^(tableId|tblId|TBL_ID)$/i,cfg.source?.table_id),itemId:readMeta(/^(itemId|itmId|ITM_ID)$/i,cfg.source?.item),industry:readMeta(/^(industry|산업코드|C2)$/i,cfg.source?.industry),size:readMeta(/^(size|규모코드|C3)$/i,cfg.source?.size)}});
 if(guard.applies&&(!guard.allowed||(mapped&&mapped.code!==guard.targetCode))){problems.push({type:'source crosswalk rejected',row:rowNo,source_code:sourceCode,reason:guard.reason});continue;}
 const gisSourceCode=provincial&&/^\d{2}000$/.test(sourceCode)?sourceCode.slice(0,2):sourceCode;
 let hits=guard.allowed?[byCode.get(guard.targetCode)].filter(Boolean):mapped?[byCode.get(mapped.code)]:cfg.code_system==='GIS'?[byCode.get(gisSourceCode)].filter(Boolean):layer.filter(p=>p.sido_name===sido&&norm(p.name)===norm(name));
 if(hits.length!==1){problems.push({type:'source ambiguous/unmatched',row:rowNo,source_code:sourceCode,name,sido});continue;}
 const p=hits[0];if(cfg.code_system==='SOURCE'&&sourceCode&&!guard.allowed&&!mapped&&gisSourceCode!==p.code){problems.push({type:'unreviewed source code crosswalk',row:rowNo,source_code:sourceCode,gis_code:p.code});continue;}if(!mapped&&(norm(p.name)!==norm(name)||(sido&&p.sido_name!==sido))){problems.push({type:'source code/name/province conflict',row:rowNo,source_code:sourceCode,name,sido});continue;}
 if(sourceKeys.has(p.code))problems.push({type:'source duplicate',row:rowNo,code:p.code});sourceKeys.add(p.code);
 const period=String(row[col('year')]??'').trim();if(col('year')>=0&&period!==(cfg.period_value||cfg.period))problems.push({type:'source period mismatch',row:rowNo,actual:period,expected:cfg.period_value||cfg.period});
 const value=numeric(row[col('value')]),out=outByCode.get(p.code),actual=out?numeric(out[cfg.output_value]):{valid:false};const equal=value.valid&&actual.valid&&!!out&&actual.value===value.value;
 checks.push({source_row:rowNo,source_code:sourceCode,gis_code:p.code,name:p.name,original_name:originalName,manual_mapping_reason:mapped?.reason||'',original_value:row[col('value')],expected:value.value,converted_value:out?.[cfg.output_value],equal});if(!equal)problems.push({type:'value mismatch',row:rowNo,code:p.code});
}
for(const r of output)if(!sourceKeys.has(r.code)&&String(r[cfg.output_value]).trim())problems.push({type:'output extra nonempty value',code:r.code});
if(!checks.length)problems.push({type:'zero rows compared'});
const report={synthetic:!!cfg.synthetic,data_provenance:cfg.data_provenance||(cfg.synthetic?'synthetic_fixture':'user_supplied_file_not_independently_downloaded'),source:cfg.source,source_hash:crypto.createHash('sha256').update(sourceBytes).digest('hex'),converted_hash:crypto.createHash('sha256').update(outputBytes).digest('hex'),sheet:cfg.sheet,headers:a.headers,period:cfg.period,source_data_rows:a.src.slice(a.dataStart).filter(row=>row.some(v=>String(v??'').trim())).length,compared_rows:checks.length,excluded_rows:excluded.length,output_rows:output.length,problems,checks,excluded,status:problems.length?'FAIL':'PASS',statistical_coverage:'Review analysis scope and any missing or excluded regions separately.',code_key_matches:output.filter(r=>byCode.has(r.code)).length,nonempty_value_matches:output.filter(r=>byCode.has(r.code)&&numeric(r[cfg.output_value]).valid&&numeric(r[cfg.output_value]).value!=='').length,target_unit:provincial?'sido':'sgg',actual_egis_UI:'UNVERIFIED'};
fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'original-vs-downloaded.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(outDir,'audit.csv'),C.csv(checks,['source_row','source_code','gis_code','name','original_value','expected','converted_value','equal']));console.log(JSON.stringify({status:report.status,synthetic:report.synthetic,compared:checks.length,excluded:excluded.length,problems:problems.length}));if(problems.length)process.exitCode=1;

} catch(error) { console.error("검증 중단: 원본 파일·결과 CSV·설정 JSON을 확인하세요. 시트와 열 이름은 원본과 같아야 하며, 출처·단위·기준일을 모두 입력해야 합니다.\n상세 원인: "+error.message); process.exitCode=2; }
