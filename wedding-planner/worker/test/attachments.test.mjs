import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{WeddingSync} from '../src/index.mjs';
import {validateFile,MAX_FILE_BYTES} from '../src/attachments.mjs';
const pageId='11111111-2222-3333-4444-555555555555',blockId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',opId='12345678-1234-1234-1234-123456789abc',uploadId='bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDWQAAAAASUVORK5CYII=','base64'));
function setup(t,initial={}){
 const data=new Map(Object.entries({['record:one']:{state:'done',pageId},...initial}));let chain=Promise.resolve();
 const ctx={storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>{for(const [a,b] of typeof k==='string'?[[k,v]]:Object.entries(k))data.set(a,structuredClone(b));}},blockConcurrencyWhile:f=>{const p=chain.then(f);chain=p.catch(()=>{});return p;}};
 const env={FIREBASE_PROJECT_ID:'test',WEDDING_NOTION_TOKEN:'test-only',ALLOWED_ORIGIN:'https://happygeo21.github.io'};
 const calls=[],control={source:200,append:200,network:false,parent:pageId,url:'https://prod-files-secure.s3.us-west-2.amazonaws.com/test.png'};
 t.mock.method(globalThis,'fetch',async(url,init={})=>{url=String(url);calls.push({url,init});
  if(url.startsWith('https://firestore.googleapis.com/'))return Response.json({fields:{revision:{integerValue:'1'}}},{status:control.source});
  if(url.endsWith('/file_uploads')){const payload=JSON.parse(init.body);assert.equal(payload.content_type,'image/png');return Response.json({id:uploadId});}
  if(url.endsWith('/send')){assert.ok(init.body instanceof FormData);assert.equal(init.body.get('file').name,'test.png');return Response.json({status:'uploaded'});}
  if(url.endsWith('/children')){if(control.network)throw Error('uncertain');return Response.json({results:[{id:blockId}]},{status:control.append});}
  if(url.endsWith('/blocks/'+blockId))return Response.json({id:blockId,type:'image',parent:{page_id:control.parent},image:{type:'file',file:{url:control.url}}});
  if(url.startsWith('https://prod-files-secure.'))return new Response(png);
  throw Error('unexpected request');
 });
 const object=new WeddingSync(ctx,env);
 const send=(action='upload',overrides={})=>object.fetch(new Request('https://internal/attachments/'+action,{method:'POST',headers:{Authorization:'Bearer test','X-Record-Id':'one','X-Record-Revision':'1','X-Attachment-Id':opId,'X-File-Name':encodeURIComponent('test.png'),...overrides},...(action==='upload'?{body:png}:{})}));
 return {data,ctx,env,calls,control,send};
}
test('attachment types and signatures reject active files, spoofs, empty and over-size inputs',()=>{
 assert.equal(validateFile('test.png',png).mime,'image/png');
 for(const [name,bytes] of [['test.html',png],['test.svg',png],['test.pdf',png],['test.jpg',png],['test.png',new Uint8Array()],['test.png',new Uint8Array(MAX_FILE_BYTES+1)]])assert.throws(()=>validateFile(name,bytes));
 assert.equal(validateFile('folder/test.txt',new TextEncoder().encode('hello')).name,'test.txt');
 assert.throws(()=>validateFile('test.txt',Uint8Array.from([255,0])));
});
test('list, upload and download all deny revoked Firebase access before Notion or metadata',async t=>{const f=setup(t);f.control.source=403;for(const action of ['list','upload','download'])assert.equal((await f.send(action)).status,403);assert.equal(f.calls.length,3);});
test('upload retry and concurrent submissions attach one block, persisting metadata only',async t=>{
 const f=setup(t);const both=await Promise.all([f.send(),f.send()]);assert.deepEqual(await Promise.all(both.map(async r=>(await r.json()).code)),['uploaded','already-uploaded']);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/children')).length,1);assert.equal(f.data.get('files:one')[0].blockId,blockId);const raw=JSON.stringify([...f.data]);assert.ok(!raw.includes('test-only'));assert.ok(!raw.includes('https://prod-files'));assert.ok(!raw.includes('iVBOR'));
});
test('ambiguous append survives restart and never creates another block',async t=>{const f=setup(t);f.control.network=true;assert.equal((await (await f.send()).json()).code,'check-notion-attachment');f.control.network=false;assert.equal((await (await f.send()).json()).code,'check-notion-attachment');assert.equal(f.calls.filter(c=>c.url.endsWith('/children')).length,1);});
test('daily and per-record file limits stop external uploads',async t=>{const day=new Date().toISOString().slice(0,10),f=setup(t,{fileUploads:{day,count:40,lastAttempt:0}});assert.equal((await (await f.send()).json()).code,'attachment-daily-limit');f.data.set('fileUploads',{});f.data.set('files:one',Array.from({length:20},()=>({blockId})));assert.equal((await (await f.send()).json()).code,'attachment-count-limit');assert.equal(f.calls.filter(c=>c.url.includes('api.notion.com')).length,0);});
test('download requires a matching record manifest, Notion parent and approved storage host',async t=>{
 const f=setup(t);assert.equal((await f.send('download',{'X-Attachment-Id':blockId})).status,404);
 f.data.set('files:one',[{blockId,name:'test.png',mime:'image/png',size:png.length}]);
 f.control.parent=uploadId;assert.equal((await f.send('download',{'X-Attachment-Id':blockId})).status,404);
 f.control.parent=pageId;f.control.url='https://attacker.example/test.png';assert.equal((await f.send('download',{'X-Attachment-Id':blockId})).status,503);
 f.control.url='https://prod-files-secure.s3.us-west-2.amazonaws.com/test.png';const result=await f.send('download',{'X-Attachment-Id':blockId});assert.equal(result.status,200);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),png);assert.equal(result.headers.get('Cache-Control'),'no-store');
});
test('attachment gateway rejects foreign origins and absent authentication on every route',async()=>{const env={ALLOWED_ORIGIN:'https://happygeo21.github.io',FIREBASE_PROJECT_ID:'test'};for(const action of ['list','upload','download']){const url='https://worker.test/attachments/'+action;assert.equal((await worker.fetch(new Request(url,{method:'POST'}),env)).status,403);assert.equal((await worker.fetch(new Request(url,{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN}}),env)).status,401);}});
