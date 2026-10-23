const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','happygeo',file),'utf8'));
test('two lessons expose exactly ten answerable questions with explanations and alignment',()=>{
 const c=read('lesson-content.json');assert.deepEqual(Object.keys(c.questions),['1','2']);
 for(const lesson of [1,2]){assert.equal(c.questions[lesson].length,5);assert.equal(c.sourceAlignment[lesson].length,5);for(const [q,options,answer,why]of c.questions[lesson]){assert(q.length>10);assert.equal(options.length,4);assert.equal(new Set(options).size,4);assert(Number.isInteger(answer)&&answer>=0&&answer<4);assert(why.length>15);}}
});
test('global representative routes have unique IDs, valid coordinates, dates and official sources',()=>{
 const {routes}=read('energy-routes.json');assert.equal(routes.length,21);assert.equal(new Set(routes.map(r=>r.id)).size,routes.length);
 for(const fuel of ['coal','oil','gas'])assert(routes.filter(r=>r.fuel===fuel).length>=6);
 for(const r of routes){assert(r.year>=2022&&r.year<=2024);assert(['www.eia.gov','www.iea.org','www.rec-cer.gc.ca'].includes(new URL(r.source).hostname));for(const [lon,lat]of[r.start,...r.waypoints||[],r.end]){assert(Number.isFinite(lon)&&lon>=-180&&lon<=180);assert(Number.isFinite(lat)&&lat>=-90&&lat<=90);}}
 assert(routes.some(r=>r.mode==='가스관'));assert(routes.some(r=>r.mode==='철도·육로'));
});

test('legacy snapshots preserve baseline source and Firebase configuration values',()=>{
 const crypto=require('node:crypto'),digest=text=>crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
 const baseline={"student":"f693b7fc3840cd97adf4d6bb7e7c8cd9e17a1b76c2f2275285134e4f106f66f2","teacher":"4136d5756c3dcda55b6f5f406ad171eb44b5c408cd47a02b06d6e6642f35431b","config":"8210ab5dfaf0465747287a5ac1cc58be5e8dd135883ca3afa7d3e8da3387ad73"};
 for(const role of ['student','teacher'])assert.equal(digest(fs.readFileSync(path.join(__dirname,'..','happygeo',role+'-legacy.html'),'utf8')),baseline[role]);
 const config=fs.readFileSync(path.join(__dirname,'..','happygeo/firebase-config.js'),'utf8').split('(function()')[0];
 assert.equal(digest(config),baseline.config);
});
