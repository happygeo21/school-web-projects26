import {attachmentGateway,handleAttachment} from './attachments.mjs';
// No service-account key: Firestore checks the caller's Firebase ID token and existing Rules.
const MAPPING_VERSION = 2;
const json = (status, code, extra = {}) => Response.json({code, ...extra}, {
  status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
});
async function readInput(request) {
  const reader=request.body?.getReader();
  if(!reader)return '';
  let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;if(size>1024){await reader.cancel();return null;}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;
  for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}
function firebaseTokenShape(authorization,project) {
  // Only Firebase ID tokens enter the REST path, never Google IAM OAuth access tokens.
  // This is a format/claims filter. Firestore MUST still verify the signature and Rules.
  const token=authorization?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
  if(!token||token.length>8000)return false;
  try{
    const decode=part=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
    const [header,claims]=token.split('.').slice(0,2).map(decode),now=Math.floor(Date.now()/1000);
    return header.alg==='RS256' && claims.aud===project && claims.iss===`https://securetoken.google.com/${project}` &&
      typeof claims.sub==='string' && claims.sub.length>0 && claims.sub.length<=128 &&
      claims.email_verified===true && claims.firebase?.sign_in_provider==='google.com' &&
      Number.isSafeInteger(claims.exp) && claims.exp>now && Number.isSafeInteger(claims.iat) && claims.iat<=now+60;
  }catch{return false;}
}
const rich = value => {
  const chars = Array.from(value || ''), parts = [];
  for (let i = 0; i < chars.length; i += 900) parts.push({type:'text', text:{content:chars.slice(i,i+900).join('')}});
  return parts;
};
export function notionProperties(r) {
  const category = {'신혼집':'화정동 주택','촬영':'웨딩 촬영'}[r.category] || r.category;
  const status = {'할 일':'확인 필요','진행 중':'문의 중','완료':'확정'}[r.status];
  if (!status || !['호텔','가족 일정','예산','혼인신고','신혼집','촬영','기타'].includes(r.category) ||
      typeof r.title !== 'string' || !r.title || r.title.length > 160 ||
      typeof r.body !== 'string' || r.body.length > 4000 || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(r.amount) || r.amount < 0 || r.amount > 1e9 ||
      ('amountKind' in r && !['미분류','예상','견적','계약금액','실제지출'].includes(r.amountKind)) ||
      ('nextAction' in r && (typeof r.nextAction !== 'string' || r.nextAction.length > 500)) ||
      ('dueDate' in r && (typeof r.dueDate !== 'string' || (r.dueDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate))))) throw Error('Invalid record');
  return {'기록 제목':{title:rich(r.title)}, '확인한 내용':{rich_text:rich(r.body)},
    '분야':{select:{name:category}}, '상태':{status:{name:status}}, '일자':{date:{start:r.date}},
    '관련 금액':{number:r.amount}, '금액 구분':{select:{name:r.amountKind || '미분류'}},
    ...('nextAction' in r ? {'다음 행동':{rich_text:rich(r.nextAction)}} : {}),
    ...('dueDate' in r ? {'예정일':{date:r.dueDate ? {start:r.dueDate} : null}} : {})};
}
function decodeDocument(doc) {
  const out = {};
  for (const [key,value] of Object.entries(doc.fields || {})) {
    if ('stringValue' in value) out[key] = value.stringValue;
    if ('integerValue' in value) out[key] = Number(value.integerValue);
    if ('doubleValue' in value) out[key] = value.doubleValue;
  }
  return out;
}
export default {
  async fetch(request, env) {
    if(new URL(request.url).pathname.startsWith('/attachments'))return attachmentGateway(request,env,firebaseTokenShape);
    const origin = request.headers.get('Origin');
    if (origin !== env.ALLOWED_ORIGIN) return json(403,'origin-denied');
    const cors = {'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN, 'Vary':'Origin'};
    let response;
    if (new URL(request.url).pathname !== '/export') response = json(404,'not-found');
    else if (request.method === 'OPTIONS') response = new Response(null, {status:204, headers:{
      'Access-Control-Allow-Methods':'POST', 'Access-Control-Allow-Headers':'Authorization, Content-Type',
      'Access-Control-Max-Age':'600'
    }});
    else if (request.method !== 'POST') response = json(405,'method-not-allowed');
    else if (!firebaseTokenShape(request.headers.get('Authorization'),env.FIREBASE_PROJECT_ID)) response = json(401,'login-required');
    else if (!request.headers.get('Content-Type')?.startsWith('application/json')) response = json(415,'invalid-request');
    else if (!env.WEDDING_NOTION_TOKEN || !env.SYNC_STATE) response = json(503,'setup-required');
    else {
      try {
        const input = await readInput(request);
        if (input === null) response = json(413,'invalid-request');
        else {
          let body;try{body=JSON.parse(input);}catch{body=null;}
          if (!body || typeof body.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.id) || !Number.isSafeInteger(body.revision) || body.revision < 1)
            response = json(400,'invalid-request');
          else {
            const stub = env.SYNC_STATE.get(env.SYNC_STATE.idFromName('private-wedding-journal-v1'));
            response = await stub.fetch(new Request('https://internal/export', {method:'POST',
              headers:{Authorization:request.headers.get('Authorization'), 'Content-Type':'application/json'}, body:input}));
          }
        }
      } catch { response = json(503,'unavailable'); }
    }
    const result = new Response(response.body, response);
    for (const [key,value] of Object.entries(cors)) result.headers.set(key,value);
    return result;
  }
};

// One SQLite-backed Durable Object serializes exports, including across devices.
// Store only page IDs/revisions/status/counters; never tokens, emails or record bodies.
export class WeddingSync {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    try {
      if(new URL(request.url).pathname.startsWith('/attachments/'))return await this.ctx.blockConcurrencyWhile(()=>handleAttachment(request,this.ctx.storage,this.env));
      return await this.ctx.blockConcurrencyWhile(async () => {
        const {id,revision} = await request.json();
        const auth = request.headers.get('Authorization');
        const url = `https://firestore.googleapis.com/v1/projects/${this.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/records/${id}`;
        let source;
        try { source = await fetch(url, {headers:{Authorization:auth}, signal:AbortSignal.timeout(5000)}); }
        catch { return json(503,'source-unavailable'); }
        // Firestore verifies project, expiry, Google provider, verified email and private allowlist.
        if (!source.ok) return json(source.status === 429 ? 429 : 403,
          source.status === 429 ? 'quota-exceeded' : 'access-denied');
        const record = decodeDocument(await source.json());
        if (record.revision !== revision) return json(409,'record-changed');
        let properties;
        try { properties = notionProperties(record); } catch { return json(400,'invalid-record'); }
        const key = `record:${id}`, storage = this.ctx.storage;
        const previous = await storage.get(key) || {};
        if (previous.state === 'sending' || previous.state === 'uncertain') return json(409,'check-notion');
        if (previous.state === 'done' && previous.revision === revision && previous.mappingVersion === MAPPING_VERSION) return json(200,'already-sent');
        if (previous.revision > revision) return json(409,'record-changed');
        const now = Date.now(), day = new Date(now).toISOString().slice(0,10);
        const usage = await storage.get('usage') || {};
        const count = usage.day === day ? usage.count : 0;
        if (count >= 200) return json(429,'daily-limit');
        if (now - (usage.lastAttempt || 0) < 6000) return json(429,'slow-down');
        // Persist intent before the external side effect. Ambiguous results never retry automatically.
        await storage.put({usage:{day,count:count+1,lastAttempt:now},
          [key]:{state:'sending',revision,mappingVersion:MAPPING_VERSION,pageId:previous.pageId || null}});
        try {
          const result = await fetch('https://api.notion.com/v1/pages' + (previous.pageId ? `/${previous.pageId}` : ''), {
            method:previous.pageId ? 'PATCH' : 'POST', signal:AbortSignal.timeout(15000),
            headers:{Authorization:`Bearer ${this.env.WEDDING_NOTION_TOKEN}`, 'Notion-Version':'2025-09-03', 'Content-Type':'application/json'},
            body:JSON.stringify({...(previous.pageId ? {} : {parent:{type:'data_source_id',data_source_id:this.env.NOTION_DATA_SOURCE}}), properties})
          });
          if (!result.ok) {
            await storage.put(key,{state:result.status < 500 ? 'rejected' : 'uncertain',revision,mappingVersion:MAPPING_VERSION,pageId:previous.pageId || null});
            return json(503,result.status < 500 ? 'notion-rejected' : 'check-notion');
          }
          const page = await result.json();
          if (!/^[0-9a-f-]{32,36}$/i.test(page.id || '')) throw Error('Missing page identity');
          await storage.put(key,{state:'done',revision,mappingVersion:MAPPING_VERSION,pageId:page.id});
          return json(200,'sent');
        } catch {
          await storage.put(key,{state:'uncertain',revision,mappingVersion:MAPPING_VERSION,pageId:previous.pageId || null});
          return json(503,'check-notion');
        }
      });
    } catch { return json(503,'unavailable'); }
  }
}
