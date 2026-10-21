import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker, {WeddingSync,notionProperties} from '../src/index.mjs';
const record = {title:'연결 확인',body:'개인정보 없는 시험 기록',date:'2026-10-21',category:'기타',status:'완료',revision:1};
const doc = r => ({fields:Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='number'?{integerValue:String(v)}:{stringValue:v}]))});
const pageId = '11111111-2222-3333-4444-555555555555';
function fixture(t,initial={}) {
  const data = new Map(Object.entries(initial)); let queue = Promise.resolve();
  const ctx = {storage:{get:async k=>structuredClone(data.get(k)), put:async(k,v)=>{
    for(const [name,value] of typeof k==='string'?[[k,v]]:Object.entries(k))data.set(name,structuredClone(value));
  }},blockConcurrencyWhile:fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};
  const env={ALLOWED_ORIGIN:'https://happygeo21.github.io',FIREBASE_PROJECT_ID:'test-project',NOTION_DATA_SOURCE:'test-source',WEDDING_NOTION_TOKEN:'test-placeholder'};
  const calls=[];const control={source:200,record:{...record},notion:200,fail:false};
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push({url,options});
    if(url.startsWith('https://firestore.googleapis.com/'))return Response.json(doc(control.record),{status:control.source});
    assert.ok(url.startsWith('https://api.notion.com/v1/pages'));
    if(control.fail)throw Error('network');
    return Response.json({id:pageId},{status:control.notion});
  });
  const object = new WeddingSync(ctx,env);
  const send = (revision=1) => object.fetch(new Request('https://internal/export',{method:'POST',headers:{Authorization:'Bearer test-user'},body:JSON.stringify({id:'record-one',revision})}));
  return {data,ctx,env,calls,control,send};
}
test('unauthorized source never reaches Notion, including after a prior success',async t=>{
  const f=fixture(t);assert.equal((await f.send()).status,200);f.control.source=403;
  assert.equal((await f.send()).status,403);assert.equal(f.calls.filter(c=>c.url.includes('api.notion.com')).length,1);
});
test('concurrent duplicate sends create only one page; changed revision updates the same page',async t=>{
  const f=fixture(t);const both=await Promise.all([f.send(),f.send()]);
  assert.deepEqual(await Promise.all(both.map(r=>r.json().then(x=>x.code))),['sent','already-sent']);
  f.control.record.revision=2;f.data.set('usage',{lastAttempt:0});assert.equal((await f.send(2)).status,200);
  const calls=f.calls.filter(c=>c.url.includes('api.notion.com'));
  assert.equal(calls.length,2);assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[1].options.method,'PATCH');assert.ok(calls[1].url.endsWith(pageId));
  assert.ok(!JSON.stringify([...f.data.values()]).includes(record.body));
});
test('stale revision is rejected before Notion',async t=>{
  const f=fixture(t);f.control.record.revision=2;
  assert.equal((await f.send()).status,409);assert.equal(f.calls.length,1);
});
test('ambiguous external result stays blocked across object restart',async t=>{
  const f=fixture(t);f.control.fail=true;assert.equal((await f.send()).status,503);
  const restarted=new WeddingSync(f.ctx,f.env);
  const result=await restarted.fetch(new Request('https://internal/export',{method:'POST',headers:{Authorization:'Bearer test-user'},body:JSON.stringify({id:'record-one',revision:1})}));
  assert.equal((await result.json()).code,'check-notion');
  assert.equal(f.calls.filter(c=>c.url.includes('api.notion.com')).length,1);
});
test('daily quota and spacing stop requests before Notion; next day resets count',async t=>{
  const day=new Date().toISOString().slice(0,10);const f=fixture(t,{usage:{day,count:200,lastAttempt:0}});
  assert.equal((await (await f.send()).json()).code,'daily-limit');
  f.data.set('usage',{day,count:1,lastAttempt:Date.now()});
  assert.equal((await (await f.send()).json()).code,'slow-down');
  f.data.set('usage',{day:'2000-01-01',count:200,lastAttempt:0});
  assert.equal((await (await f.send()).json()).code,'sent');
  assert.equal(f.calls.filter(c=>c.url.includes('api.notion.com')).length,1);
});
test('source quota errors and Notion errors do not report success',async t=>{
  const f=fixture(t);f.control.source=429;
  assert.equal((await (await f.send()).json()).code,'quota-exceeded');
  f.control.source=200;f.control.notion=500;
  assert.equal((await (await f.send()).json()).code,'check-notion');
});
test('public endpoint denies absent auth and foreign origin; CORS only matches allowed site',async()=>{
  const env={ALLOWED_ORIGIN:'https://happygeo21.github.io'};
  assert.equal((await worker.fetch(new Request('https://example/export',{method:'POST'}),env)).status,403);
  const r=await worker.fetch(new Request('https://example/export',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN}}),env);
  assert.equal(r.status,401);assert.equal(r.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGIN);
  const preflight=await worker.fetch(new Request('https://example/export',{method:'OPTIONS',headers:{Origin:env.ALLOWED_ORIGIN}}),env);
  assert.equal(preflight.status,204);
});
test('IAM OAuth, wrong-project, unverified, non-Google and expired tokens never reach storage',async()=>{
  let forwards=0;const now=Math.floor(Date.now()/1000);
  const env={ALLOWED_ORIGIN:'https://happygeo21.github.io',FIREBASE_PROJECT_ID:'test-project',WEDDING_NOTION_TOKEN:'test-placeholder',
    SYNC_STATE:{idFromName:x=>x,get:()=>({fetch:async()=>{forwards++;return Response.json({code:'access-denied'},{status:403});}})}};
  const claims={aud:'test-project',iss:'https://securetoken.google.com/test-project',sub:'test-user',email_verified:true,firebase:{sign_in_provider:'google.com'},exp:now+3600,iat:now};
  const jwt=overrides=>[Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url'),Buffer.from(JSON.stringify({...claims,...overrides})).toString('base64url'),'fake-signature-for-test'].join('.');
  const send=token=>worker.fetch(new Request('https://example/export',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:'test',revision:1})}),env);
  for(const token of ['google-oauth-access-token',jwt({aud:'other-project'}),jwt({email_verified:false}),jwt({firebase:{sign_in_provider:'password'}}),jwt({exp:now-1})])assert.equal((await send(token)).status,401);
  assert.equal(forwards,0);
  // Well-shaped claims alone never grant access: the downstream Firestore denial is preserved.
  assert.equal((await send(jwt({}))).status,403);assert.equal(forwards,1);
});
test('mapping preserves long Unicode text, maps categories/status and excludes money',()=>{
  const body='😀'.repeat(2000);const result=notionProperties({...record,body,category:'신혼집',amount:100});
  assert.equal(result['분야'].select.name,'화정동 주택');assert.equal(result['상태'].status.name,'확정');
  assert.equal(result['확인한 내용'].rich_text.map(p=>p.text.content).join(''),body);
  assert.ok(result['확인한 내용'].rich_text.every(p=>p.text.content.length<=2000));
  assert.ok(!JSON.stringify(result).includes('amount'));
});
