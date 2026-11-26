/* Reproduce full-value checks from the preserved QA package and actual UI downloads.
   Originals stay outside the public runtime. No name-only joins or prepared inputs. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),qa=process.argv[2],downloads=process.argv[3];
if(!qa||!downloads)throw Error('Usage: node audit-originals.cjs EXTRACTED_QA UI_DOWNLOAD_DIRECTORY');
const W=require(path.join(root,'kosis-egis-tool/kosis-workbook.js')),C=require(path.join(root,'kosis-egis-tool/core.js')),A=require(path.join(root,'kosis-egis-tool/aging-xlsx.js')),X=require(path.join(root,'kosis-egis-tool/vendor/xlsx-0.20.3.full.min.js'));
const registry=require(path.join(root,'kosis-egis-tool/region-registry.json')),refs={sido:require(path.join(root,'kosis-egis-tool/sido-reference.json')),sgg:require(path.join(root,'kosis-egis-tool/reference.json'))};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>X.read(fs.readFileSync(f),{type:'buffer'}),json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
const bundle=json(path.join(qa,'bundle_manifest.json'));for(const f of bundle.files)assert.equal(sha(fs.readFileSync(path.join(qa,f.path))),f.sha256,f.path);
const originalCodebook=read(path.join(qa,'Official_References/KSSC_20241231_original.xlsx'));
const official=X.utils.sheet_to_json(originalCodebook.Sheets[originalCodebook.SheetNames.find(n=>n.startsWith('2-2.'))],{header:1,defval:''});
const rawByCode=new Map(official.filter(r=>/^(\d{2}|\d{5})$/.test(String(r[5]))).map(r=>[String(r[5]),r]));
const hashes=Object.fromEntries(['sido','sgg'].map(l=>[l,sha(fs.readFileSync(path.join(root,'kosis-egis-tool',l==='sido'?'sido-2025.geojson':'sigungu-2025.geojson')))]));
const cases=json(path.join(qa,'regression_manifest.json')).inputs.map(c=>({...c,file:path.join(qa,c.path)}));
cases.push({case:'INH-existing',file:path.join(root,'tests/kosis-egis/fixtures/crosswalk-20261126/fertility-2024.xlsx'),sha256:'87bcb909699e2cf9ac65135022f614b63a60fb7a3e45845475168f8fd0801a55',ui_scope:{comparison:'sido',scope:'all'}});
cases.push({case:'national-households-existing',file:path.join(root,'tests/kosis-egis/fixtures/crosswalk-20261126/households-2024.xlsx'),ui_scope:{comparison:'regional',scope:'11'}});
cases.push({case:'culture-selected4-existing',file:path.join(root,'tests/kosis-egis/fixtures/crosswalk-20261126/culture-seoul-subset-2024.xlsx'),ui_scope:{comparison:'regional',scope:'sample'},selectedCodes:['11110','11140','11170','11200']});
const results=[],outputs=new Map();
for(const c of cases){
 const bytes=fs.readFileSync(c.file);if(c.sha256)assert.equal(sha(bytes),c.sha256);
 const book=read(c.file),before=JSON.stringify(book),input=W.read(book,X),level=c.ui_scope.comparison==='sido'?'sido':'sgg';
 const settings={unitConfirmed:true,targetUnit:level,confirmedUnit:level,period:'2024',scope:c.ui_scope.scope,selectedCodes:c.selectedCodes,aggregation:'none',code:0,name:1,sido:2,year:3,metrics:[4]};
 const result=W.convert(input,registry,refs,settings,hashes[level]);assert.equal(JSON.stringify(book),before);
 // Compare each parsed value directly with the original XLSX cell, including
 // every row in blocked files, instead of trusting the converter's own audit.
 const sheet=book.Sheets['데이터'],dataCols=Object.entries(sheet).filter(([key,v])=>/^[A-Z]+1$/.test(key)&&String(v.v).startsWith('Y2024 ')).map(([key])=>X.utils.decode_cell(key).c).sort((a,b)=>a-b);
 let compared=0;for(const r of input.records)for(let m=0;m<input.metrics.length;m++){assert.equal(r.values[m],sheet[X.utils.encode_cell({r:r.sourceRow-1,c:dataCols[m]})]?.v??'');compared++;}
 const record={case:c.case,file:path.basename(c.file),sha256:sha(bytes),table:input.tableId,headerRows:input.headerRows,inputRows:input.records.length,originalCellsCompared:compared,status:result.summary.status,matched:result.output.length,scope:settings.scope,reason:result.issues[0]?.detail||null,uiMapVerified:['A','INH-existing'].includes(c.case),verificationEnvironment:'Node.js common-engine audit; UI evidence is recorded separately; no physical-device acceptance'};
 if(result.output.length){
  const normalizedCsv=C.csv(result.output,result.headers),parsed=C.parseDelimited(normalizedCsv),hs=parsed.shift();assert.equal(parsed.length,result.output.length);
  for(const out of result.output){const source=input.records.find(r=>r.sourceCode===out.kosis_source_code),off=rawByCode.get(out.kosis_source_code);assert(off);assert.equal(String(off[6]).slice(0,level==='sido'?2:5),out.code);assert.equal(off[2].replace(/\s/g,''),source.name.replace(/\s/g,''));assert.equal(off[0],out.sido_name);assert.equal(Number(source.values[0]),out[input.metrics[0].id]);assert.equal(out.name,refs[level].find(r=>r.code===out.code).name);}
  fs.writeFileSync(path.join(artifacts,c.case+'-converted.csv'),normalizedCsv);fs.writeFileSync(path.join(artifacts,c.case+'-cell-audit.csv'),C.csv(result.audit,Object.keys(result.audit[0])));
  outputs.set(c.case,{result,input});record.outputCellsCompared=result.output.length;
  const uiFile={B:'egis_DT_1B8000H_2024_all.csv',H:'egis_DT_1YL20842_2024_26.csv'}[c.case];
  if(uiFile){const downloaded=fs.readFileSync(path.join(downloads,uiFile));assert.equal(downloaded.toString('utf8'),normalizedCsv);record.uiCsvVerified=true;record.automaticRecommendation=c.case==='B'?'sido/all':'sgg/26';record.uiCsvSha256=sha(downloaded);}
 }else assert.deepEqual(result.output,[]);
 results.push(record);
}
assert.deepEqual(results.slice(0,10).filter(r=>r.matched).map(r=>r.case),['A','B','H']);
assert.equal(results.find(r=>r.case==='national-households-existing').matched,0);
const dt=outputs.get('B').result.output,inh=outputs.get('INH-existing').result.output;for(const row of dt)assert.equal(row.T12,inh.find(i=>i.code===row.code).value);
const mapRuns=[{case:'A',stem:'PR29_A_Seoul25_2024',csv:'egis_DT_1YL21161_2024_11.csv',metric:'T10'},{case:'INH-existing',stem:'PR29_B_INH_Sido17_2024',csv:'egis_INH_1B81A17_2024_all.csv',metric:'value'}];
for(const run of mapRuns){
 const expected=outputs.get(run.case).result.output,csvBytes=fs.readFileSync(path.join(downloads,run.csv)),csv=C.parseDelimited(csvBytes.toString('utf8')),headers=csv.shift();assert.equal(csv.length,expected.length);
 assert.equal(csvBytes.toString('utf8'),C.csv(expected,outputs.get(run.case).result.headers),'Final engine output differs from actual browser download');
 const byCode=new Map(csv.map(r=>[r[headers.indexOf('code')],Object.fromEntries(headers.map((h,i)=>[h,r[i]]))]));
 for(const row of expected){assert.equal(Number(byCode.get(row.code)[run.metric]),row[run.metric]);assert.equal(byCode.get(row.code).name,row.name);assert.equal(byCode.get(row.code).kosis_source_code,row.kosis_source_code);}
 const saved=json(path.join(downloads,run.stem+'.egis')),reopened=json(path.join(downloads,run.stem+'_reopened.egis'));
 const sourceLayers=saved.layers;assert.equal(saved.layers.length,2);assert.equal(reopened.layers.length,2);
 for(const [version,project] of [['saved',saved],['reopened',reopened]])for(const [i,layer] of project.layers.entries()){
  assert.equal(layer.features.features.length,expected.length);const seen=new Set();
  for(const feature of layer.features.features){const p=feature.properties,row=expected.find(r=>r.code===String(p.code));assert(row);assert(!seen.has(row.code));seen.add(row.code);
   for(const key of ['name','sido_name','stat_title','unit','source_url','classification_date','code_system'])assert.equal(p[key],row[key],version+' '+row.code+' '+key);
   for(const key of ['kosis_source_code','stat_year','base_year'])assert.equal(String(p[key]),row[key]);assert.equal(p[run.metric],row[run.metric]);
   if(version==='reopened'){const original=sourceLayers[i].features.features.find(f=>f.properties.code===p.code);assert.deepEqual(feature.geometry,original.geometry);}
  }
 }
 const theme=reopened.layers.find(l=>l.choroplethConfig);assert(theme);assert.equal(theme.choroplethConfig.attribute,run.metric);assert.equal(theme.choroplethConfig.format,'decimal2');
 const record=results.find(r=>r.case===run.case);record.actualMap={joined:expected.length,savedLayers:2,reopenedLayers:2,allValuesAndTextMetadataMatch:true,reopenedGeometryPreserved:true,pdf:path.basename(run.stem+'.pdf'),representativeImage:'Rendered from actual e-GIS PDF, not native PNG download',nativePngDownload:'not confirmed: IAB download event timed out for A',legendDisplayDigits:2,sourcePrecisionPreserved:true,files:{}};
 for(const suffix of ['.egis','_reopened.egis','.pdf']){const file=run.stem+suffix,bytes=fs.readFileSync(path.join(downloads,file));record.actualMap.files[file]={bytes:bytes.length,sha256:sha(bytes)};if(suffix!=='.pdf')fs.copyFileSync(path.join(downloads,file),path.join(artifacts,file));}
 fs.copyFileSync(path.join(downloads,run.csv),path.join(artifacts,run.csv));
}
const aging=[];for(const [level,file] of [['sgg','A_전남22_2024_KOSIS원본.xlsx'],['sido','B_시도17_2024_KOSIS원본.xlsx']]){const source=path.join(root,'tests/kosis-egis/fixtures/real-2024',file),input=A.read(read(source),X,refs),r=A.convert(input,{unitConfirmed:true,confirmedUnit:level,targetUnit:level,scope:level==='sgg'?'46':'all',period:'2024',aggregation:'none',metrics:[5],name:1,code:0,sido:3,year:7});assert.equal(r.output.length,level==='sgg'?22:17);for(const a of r.audit)assert.equal(a.original_value,a.output_value);aging.push({file,sha256:sha(fs.readFileSync(source)),matched:r.output.length,verification:'Unchanged PR28 adapter: original XLSX to CSV regression; real maps not newly recreated in this run'});}
const report={createdAt:new Date().toISOString(),qaBundleFilesVerified:bundle.files.length,qaFixedOriginals:10,fixedOriginalCsvSuccesses:3,newActualMapSuccesses:2,alternativeFertilityMatchesINH:17,results,agingRegression:aging,limitations:['2024 annual data only','No physical iPad/phone or independent Aside acceptance yet','Seven fixed originals safely blocked; no claim of arbitrary-table support','Native e-GIS PNG export not confirmed in IAB; representative PNGs are rendered from actual PDFs','No main merge or production deployment']};
fs.writeFileSync(path.join(__dirname,'validation-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({fixed:results.slice(0,10).map(r=>[r.case,r.status,r.matched]),newMaps:2,aging:aging.map(a=>a.matched),bundleFiles:bundle.files.length}));
