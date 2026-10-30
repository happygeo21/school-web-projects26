// Runs the exact PR #8 engine; independently checks each input value and actual layer key.
const fs=require('node:fs'),path=require('node:path'),C=require('./core.js'),ref=require('./reference.json');
const [input,configPath,outDir='results']=process.argv.slice(2);
if(!input||!configPath){console.error('Usage: node verify.cjs input.csv config.json [output-directory]');process.exit(2);}
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,'')),data=C.parseDelimited(C.decode(fs.readFileSync(input))),headers=data[0];
if(!/^\d{4}$/.test(cfg.period))throw Error('Set the actual four-digit statistical year.');
if(!cfg.synthetic){for(const k of ['title','table_id','item','unit','reference_date','url','download_date'])if(!cfg.source?.[k]||String(cfg.source[k]).includes('REPLACE'))throw Error('Complete official provenance field: '+k);}
for(const k of ['name','value'])if(!headers.includes(cfg.columns[k]))throw Error('Missing selected source column: '+k);
const col=k=>headers.indexOf(cfg.columns[k]||'');
const geo=JSON.parse(fs.readFileSync(path.join(__dirname,'egis-sigungu.geojson'),'utf8')),props=geo.features.map(f=>f.properties),actual=new Map(props.map(p=>[p.code,p]));
const layerDifferences=[];
for(const r of ref){const a=actual.get(r.code);if(!a)layerDifferences.push({code:r.code,missing:true});else for(const k of ['code','name','sido','sido_name','base_year'])if(a[k]!==r[k])layerDifferences.push({code:r.code,field:k,reference:r[k],layer:a[k]});}
if(actual.size!==props.length||actual.size!==ref.length||layerDifferences.length)throw Error('Actual layer and reference differ; review layer version first.');
const a=C.structure(data,[]); // no merged cells in CSV
const code=cfg.code_system==='GIS'?col('code'):-1;
const result=C.convert(ref,a,{name:col('name'),code,sido:col('sido'),year:col('year'),metrics:[col('value')],period:cfg.period,sourceProfile:cfg.source_profile||'',scope:cfg.scope||'all'});
const valueHeader=result.headers[5],lookup=new Map(result.output.map(r=>[r.code,r])),checks=[],unresolved=[],expectedCodes=new Set();
const simple=v=>String(v??'').trim().replace(/\s+/g,'').normalize('NFC');
for(let i=1;i<data.length;i++){
 const row=data[i],sourceName=String(row[col('name')]||'').trim(),sido=C.province(row[col('sido')]),rawCode=String(row[col('code')]||'').trim();
 let hits;
 if(code>=0)hits=props.filter(r=>r.code===rawCode);
 else hits=props.filter(r=>simple(r.name)===simple(sourceName)&&(!sido||r.sido_name===sido));
 if(hits.length!==1){unresolved.push({source_row:i+1,name:sourceName,source_code:rawCode,reason:'Independent exact name/province or GIS code is not unique'});continue;}
 const r=hits[0],actualRow=lookup.get(r.code),v=String(row[col('value')]??'').trim();
 const missing=/^(?:|-|–|—|\.\.|…|N\/A|NA|X|\*)$/i.test(v);
 // Independent numeric parse: do not use C.number to establish the expected value.
 const expected=missing?'':Number(v.replace(/,/g,'').replace(/%$/,''));
 const valid=missing||Number.isFinite(expected);expectedCodes.add(r.code);
 checks.push({source_row:i+1,source_code:rawCode,gis_code:r.code,name:r.name,source_value:v,expected,converted:actualRow?.[valueHeader],exists:!!actualRow,equal:valid&&!!actualRow&&actualRow[valueHeader]===expected});
}
const unequal=checks.filter(x=>!x.equal),counts=new Map();checks.forEach(x=>counts.set(x.gis_code,(counts.get(x.gis_code)||0)+1));
const duplicates=[...counts].filter(([k,n])=>n>1),layerJoined=result.output.filter(r=>actual.has(r.code)&&r[valueHeader]!=='').length;
const report={synthetic:!!cfg.synthetic,source:cfg.source,source_hash:require('node:crypto').createHash('sha256').update(fs.readFileSync(input)).digest('hex'),period:cfg.period,code_system:cfg.code_system,layer_key:'code',csv_key:'code',actual_layer_features:props.length,layer_differences:layerDifferences,engine_summary:result.summary,input_data_rows:data.length-1,independently_checked:checks.length,unequal_count:unequal.length,unresolved_count:unresolved.length,duplicate_codes:duplicates,nonempty_values_joined_to_actual_layer:layerJoined,checks,unresolved,unequal,actual_egis_UI:'UNVERIFIED'};
fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'comparison.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(outDir,'converted.csv'),C.csv(result.output,result.headers));fs.writeFileSync(path.join(outDir,'engine-issues.json'),JSON.stringify(result.issues,null,2));
console.log(JSON.stringify({synthetic:report.synthetic,input:report.input_data_rows,checked:checks.length,unequal:unequal.length,unresolved:unresolved.length,layerJoined,status:result.summary.status,actual_egis_UI:'UNVERIFIED'}));
if(unequal.length||unresolved.length||duplicates.length)process.exitCode=1;
