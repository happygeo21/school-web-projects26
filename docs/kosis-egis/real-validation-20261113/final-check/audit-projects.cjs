// Read only the actual e-GIS files downloaded through the UI; never render a substitute map.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../../../../kosis-egis-tool/core.js');
const downloads=process.argv[2]; if(!downloads)throw Error('Pass the actual downloads directory');
const read=n=>JSON.parse(fs.readFileSync(path.join(downloads,n),'utf8'));
const pairs=[['A','HappyGEO_2024_전남22_최종검증_20261113.egis','HappyGEO_2024_전남22_재열기.egis',22],['B','HappyGEO_2024_시도17_검증_20261113.egis','HappyGEO_2024_시도17_재열기_수업용.egis',17]];
const result=[];
for(const [scope,before,after,count] of pairs){
 const original=read(before),reopened=read(after),csv=C.parseDelimited(C.decode(fs.readFileSync(path.join(__dirname,'..',scope+'_verified.csv'))));
 const expected=csv.slice(1).map(r=>Object.fromEntries(csv[0].map((k,i)=>[k,r[i]])));
 assert.deepEqual(original.layers.map(l=>l.id),reopened.layers.map(l=>l.id));
 const joined=reopened.layers.filter(l=>l.features.features.some(f=>f.properties.aging_pct!==undefined));
 assert.equal(joined.length,2);
 for(const layer of joined){
  const features=layer.features.features;assert.equal(features.length,count);assert.equal(new Set(features.map(f=>String(f.properties.code))).size,count);
  for(const e of expected){const p=features.find(f=>String(f.properties.code)===e.code)?.properties;assert(p);for(const k of ['code','name','aging_pct','kosis_source_code','year','unit','source'])assert.equal(String(p[k]),e[k],scope+':'+e.code+':'+k);}
 }
 const differences=[],featureOrderChanged=[];for(let i=0;i<original.layers.length;i++){const a=original.layers[i],b=reopened.layers[i];for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(k==='features'){if(JSON.stringify(a[k])!==JSON.stringify(b[k]))featureOrderChanged.push(a.name);const sorted=v=>[...v.features].sort((x,y)=>String(x.properties.code).localeCompare(String(y.properties.code)));assert.deepEqual(sorted(a[k]),sorted(b[k]),a.name+': geometry/properties');}else if(JSON.stringify(a[k])!==JSON.stringify(b[k]))differences.push({layer:a.name,key:k});}}
 // Sido classroom copy intentionally hides the 2026.07 16-province layer. No feature/style changes.
 if(scope==='B'){const a=original.layers.at(-1).choroplethConfig,b=reopened.layers.at(-1).choroplethConfig;assert.deepEqual({...a,controlsHidden:true},b);}
 assert.deepEqual(differences,scope==='B'?[{layer:'대한민국 시도(2026.07.01.~)',key:'visible'},{layer:'대한민국 시도(~2026.06.30.)_단계구분_aging_pct',key:'choroplethConfig'}]:[]);
 result.push({scope,count,matched:count,unmatched:0,joinedLayers:joined.map(l=>({name:l.name,count:l.features.features.length})),layerOrderPreserved:true,geometryAndPropertiesPreservedByCode:true,featureOrderChanged,layerDifferences:differences,viewPreserved:JSON.stringify(original.view)===JSON.stringify(reopened.view),samples:expected.filter(e=>['46790','46770','46230','46'].includes(e.code)),files:[before,after].map(n=>({name:n,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(downloads,n))).digest('hex')}))});
}
fs.writeFileSync(path.join(__dirname,'project-audit.json'),JSON.stringify({checkedAt:new Date().toISOString(),method:'Actual e-GIS UI reopen and resave, then saved-file comparison against verified CSV',result},null,2)+'\n');
console.log(JSON.stringify(result,null,2));
