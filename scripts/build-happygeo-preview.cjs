/* Produce an offline, Firebase-free review artifact outside the public site. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,'happygeo',file),'utf8');
const payload={};for(const file of ['lesson-content.json','energy-characters.json','energy-routes.json','assets/world-land.geojson'])payload[file]=JSON.parse(read(file));
const images={};
for(const theme of ['pokemon','mascot','disney'])for(const id of Object.keys(payload['energy-characters.json'])){
 const file=`assets/profiles/${theme}/${id}.jpg`;images[file]='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'happygeo',file)).toString('base64');
}
for(let p=4;p<=16;p++){const file=`assets/textbook/p${String(p).padStart(2,'0')}.jpg`;images[file]='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'happygeo',file)).toString('base64');}
const body=file=>read(file).match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'').replace(/<footer>[\s\S]*?<\/footer>/g,'');
const data=value=>JSON.stringify(value).replace(/</g,'\\u003c');
let store=read('two-lessons-store.js').replace(/export /g,'').replace("const demo=new URLSearchParams(location.search).get('demo')==='1';",'const demo=true;');
let app=read('two-lessons.js').replace(/^import .*?;\r?\n/gm,'').replace(/const json=async path=>.*?;\r?\n/,"const json=async path=>structuredClone(PREVIEW_DATA[path]);\n");
app=app.replace(/assets\/profiles\/\$\{state.theme\}\/\$\{id\}\.jpg/g,"${PREVIEW_IMAGES['assets/profiles/'+state.theme+'/'+id+'.jpg']}");
app=app.replace(' await renderWorld();'," document.querySelectorAll('a[href^=\"assets/textbook/\"]').forEach(a=>a.href=PREVIEW_IMAGES[a.getAttribute('href')]);\n await renderWorld();");
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>에너지 결정사 · 오프라인 검토 데모</title><style>${read('two-lessons.css')}</style></head><body><script type="module">
const PREVIEW_DATA=${data(payload)},PREVIEW_IMAGES=${data(images)};
const teacherMode=new URLSearchParams(location.search).get('role')==='teacher';
document.body.dataset.role=teacherMode?'teacher':'student';
document.body.innerHTML='<div class="notice row" style="margin:0;border-radius:0"><b>오프라인 검토본 · 운영 연결 없음</b><a class="button" href="?role=teacher">① 교사 데모·학급 만들기</a><a class="button" href="?role=student">② 학생 데모</a></div>'+(teacherMode?${data(body('teacher-v2.html'))}:${data(body('student-v2.html'))});
${store}
${read('energy-map.js').replace(/export /g,'')}
${app}
</script></body></html>`;
const output=process.argv[2]||path.join(root,'..','happygeo-review.html');
fs.writeFileSync(output,html);console.log('Offline review artifact: '+output+' ('+Buffer.byteLength(html)+' bytes)');
