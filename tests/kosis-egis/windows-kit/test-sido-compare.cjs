// Synthetic values against actual e-GIS province attributes. No official statistics download.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),XLSX=require('./site/kosis-egis-tool/xlsx.full.min.js'),C=require('./core.js');
const ref=JSON.parse(fs.readFileSync(path.join(__dirname,'egis-sido-2025.geojson'),'utf8')).features.map(f=>({...f.properties,sido:f.properties.code,sido_name:f.properties.name}));
const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'egis-sido-qa-')),heads=['code','name','sido','sido_name','base_year','연습값'];
const source=[['지역명','code','통계연도','연습값'],...ref.map((r,i)=>[r.name,r.code,'2025',i===1?'-':i])];
const config={synthetic:true,target_unit:'sido',period:'2025',sheet:'합성',header_start:1,header_depth:1,code_system:'GIS',columns:{name:'지역명',code:'code',year:'통계연도',sido:'',value:'연습값'},output_value:'연습값'};
const output=ref.map((r,i)=>({...r,'연습값':i===1?'':i}));let count=0;
function run(label,data,expected){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(source),'합성');fs.writeFileSync(path.join(dir,'source.xlsx'),XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify(config));fs.writeFileSync(path.join(dir,'download.csv'),C.csv(data,heads));const out=path.join(dir,'run-'+count);const p=spawnSync(process.execPath,[path.join(__dirname,'compare-excel.cjs'),path.join(dir,'source.xlsx'),path.join(dir,'download.csv'),path.join(dir,'config.json'),out],{encoding:'utf8'});assert.equal(p.status,expected,p.stdout+p.stderr);const r=JSON.parse(fs.readFileSync(path.join(out,'original-vs-downloaded.json'),'utf8'));if(!expected){assert.equal(r.compared_rows,17);assert.equal(r.target_unit,'sido');assert.equal(r.nonempty_value_matches,16);}count++;console.log('PASS',label,r.status);}
run('province17 source and downloaded CSV preserve zero/missing',output,0);
source.slice(1).forEach(r=>r[1]+='000');run('verified padded province codes map to original two-digit keys',output,0);
run('changed province statistic rejected',output.map((r,i)=>i?r:{...r,'연습값':999}),1);
run('duplicated province output rejected',[...output,output[0]],1);
run('wrong province metadata rejected',output.map((r,i)=>i?r:{...r,sido_name:'다른시도'}),1);
source[1][1]='99';run('unknown source province code rejected',output,1);
fs.writeFileSync(path.join(__dirname,'last-sido-summary.json'),JSON.stringify({at:Date.now(),cases:count,failed:0,scope:'synthetic values; actual province boundary attributes'},null,2));console.log('Passed',count,'synthetic provincial comparisons; evidence:',dir);
