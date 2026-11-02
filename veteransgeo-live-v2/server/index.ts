import {createGateway} from './gateway.mjs';
import {createAdapters} from './supabase-adapter.mjs';
import {serverKeyFromEnvironment} from './supabase-key.mjs';
import {verifyFirebaseToken} from './firebase-token.mjs';
import {digestBytes,publicWork,validateMedia} from '../media-policy.js';
import {validateRecord,EDITABLE,MEDIA_TYPES,externalLink} from '../upgrade-core.js';
const req=(k:string)=>{const s=Deno.env.get(k);if(!s||s.trim()!==s)throw Error('Invalid V2 configuration');return s;};
const projectId=req('FIREBASE_PROJECT_ID'),sb=req('SUPABASE_URL');
if(projectId!=='veteransgeo-test-2026'||sb!=='https://jfkjuhxkcctfmwojhpci.supabase.co')throw Error('V2 rehearsal target only');
const teachers=JSON.parse(req('APPROVED_TEACHER_UIDS')),scopes=JSON.parse(req('INVITE_TEACHER_SCHOOLS'));
const origin='https://veteransgeo-live-v2.pages.dev',root='veteransgeoLiveV2',key=serverKeyFromEnvironment((k:string)=>Deno.env.get(k));
const adapters=createAdapters({supabaseURL:sb,serviceKey:key,bucket:'veterans-v2-private',databaseURL:req('FIREBASE_DATABASE_URL'),root});
const adminHeaders:Record<string,string>=key.startsWith('sb_')?{apikey:key}:{apikey:key,Authorization:'Bearer '+key};
async function rpc(name:string,data:unknown){const r=await fetch(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{...adminHeaders,'Content-Type':'application/json'},body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok){let code='media/unavailable';const t=await r.text();if(/quota|daily_limit/.test(t))code='media/quota-full';else if(/v2_denied|permission/.test(t))code='media/permission';else if(/v2_paused/.test(t))code='media/permission';throw{code};}return r.json();}
const actorFor=(p:any)=>{const teacher=teachers.includes(p.sub)&&p.firebase?.sign_in_provider!=='anonymous';const schools=teacher?(scopes[p.sub]||[]):[];return{uid:p.sub,teacher,schools};};
const access=(a:string,p:any,actor:any)=>rpc('veterans_v2_records_access',{a,p,actor});
const verify=(token:string)=>verifyFirebaseToken(token,{projectId});
const gateway=createGateway({...adapters,verify,db:{work:async(p:any,t:string)=>{const who=actorFor(await verify(t));return(await access('read',{kind:'works',school:p.schoolId,owner:p.ownerUid,id:p.workId},who))[0]?.data||null;},published:async(id:string)=>{const rows=await access('public',{kind:'works'},{});return rows.find((r:any)=>r.public_id===id)?.data||null;}},teachers,moderatedOpenUploads:true,allowLegacyActivityCodeUpload:false,origins:[origin],deployment:{kind:'veteransgeo-v2-rehearsal',testOnly:true,apiVersion:2,firebaseProjectId:projectId,supabaseHost:new URL(sb).host,storageBucket:'veterans-v2-private'}});
const publicFields=['schoolId','category','placeOrigin','placeName','placeDescription','address','latitude','longitude','officialStatus','awarenessScore','importance','visibility','scoreReason','sourceType','sourceNote','rememberSentence','message','keywords','createdAt'];
const time=(v:any):any=>v&&typeof v==='object'?('.sv'in v?Date.now():Array.isArray(v)?v.map(time):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,time(x)]))):v;
Deno.serve(async(request:Request)=>{const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization,Content-Type,X-School-Id,X-Work-Id,X-Upload-Grant,Range','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store'};const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json'}});try{
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin)throw{code:'media/permission'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const url=new URL(request.url);
 if(request.method==='GET')return gateway(request);
 if(request.method!=='POST')throw{code:'media/permission'};
 const upload=url.searchParams.get('action')==='upload';
 let body:any={};if(!upload){if(Number(request.headers.get('content-length')||0)>65536)throw{code:'media/invalid-request'};const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw{code:'media/invalid-request'};}chunks.push(value);}}const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}body=JSON.parse(new TextDecoder().decode(raw));}
 const isDB=body.action==='v2-db';
 const writing=upload||(isDB&&body.method==='set');
 await rpc('veterans_v2_guard',{p_write:writing});
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 let claims:any=null;let actor:any={};if(token){claims=await verify(token);actor=actorFor(claims);}
 if(!isDB){if(!claims)throw{code:'auth/invalid-token'};if(actor.teacher){const school=upload?request.headers.get('X-School-Id'):body.schoolId;if(!school||!actor.schools.includes(school))throw{code:'media/permission'};}if(body.action==='reconcile'||body.action==='usage')throw{code:'media/permission'};return gateway(upload?request:new Request(request.url,{method:request.method,headers:request.headers,body:JSON.stringify(body)}));}
 const parts=String(body.path||'').split('/').filter(Boolean);if(parts.shift()!==root)throw{code:'media/permission'};
 const [kind,school,owner,id]=parts;
 if(body.method==='get'){
 if(['published','publishedWorks'].includes(kind)){const rows=await access('public',{kind:kind==='published'?'submissions':'works'},{});return json(Object.fromEntries(rows.map((r:any)=>[r.public_id,r.data])));}
 if(!claims||!['submissions','works','audit','workAudit'].includes(kind)||claims.firebase?.sign_in_provider!=='anonymous'&&(!actor.teacher||!actor.schools.length))throw{code:'media/permission'};
 const auditKind=kind==='audit'||kind==='workAudit';let rows=await access('read',{kind:kind==='audit'?'submissions':kind==='workAudit'?'works':kind,...(auditKind?{}:{school,owner,id})},actor);if(auditKind&&school)rows=rows.filter((r:any)=>`${r.school}_${r.owner}_${r.id}`===school);
 if(kind==='audit'||kind==='workAudit')return json(Object.fromEntries(rows.flatMap((r:any)=>r.audit.map((a:any,i:number)=>[String(i),a]))));
 if(school&&owner&&id)return json(rows[0]?.data||null);if(school&&owner)return json(Object.fromEntries(rows.map((r:any)=>[r.id,r.data])));
 const tree:any={};for(const r of rows){tree[r.school]??={};tree[r.school][r.owner]??={};tree[r.school][r.owner][r.id]=r.data;}return json(tree);
 }
 if(!claims)throw{code:'auth/invalid-token'};
 if(body.method==='set'){
 if(!['submissions','works'].includes(kind)||parts.length!==4||actor.teacher||claims.firebase?.sign_in_provider!=='anonymous'||owner!==claims.sub)throw{code:'media/permission'};
 const data=time(body.data);if(data.schoolId!==school||data.status!=='pending'||Number(data.createdAt)<1)throw{code:'media/invalid-request'};
 if(kind==='submissions'){validateRecord(data);if(data.schemaVersion!==2||data.awarenessOriginal?.score!==data.awarenessScore||data.awarenessOriginal?.timing!=='before-exploration')throw{code:'media/invalid-request'};}else{if(!data.studentOriginal||typeof data.title!=='string'||!data.title.trim()||data.title.length>100||typeof data.introduction!=='string'||!data.introduction.trim()||data.introduction.length>500||!MEDIA_TYPES.includes(data.type)||!['text','upload','external'].includes(data.submissionMode))throw{code:'media/invalid-request'};for(const k of['schoolId','activityCode','facilityName','title','type','introduction','entryId','submissionMode'])if(data.studentOriginal[k]!==data[k])throw{code:'media/invalid-request'};if(data.submissionMode==='upload'){validateMedia({type:data.contentType,size:data.size});if(!/^[a-f0-9]{64}$/.test(data.sha256))throw{code:'media/invalid-request'};}if(data.submissionMode==='external')externalLink(data.externalUrl);}
 const public_id='p_'+await digestBytes(new TextEncoder().encode(`${school}_${owner}_${id}`));if(kind==='works'&&data.submissionMode==='upload'&&data.mediaAssetId!==public_id)throw{code:'media/invalid-request'};
 return json(await access('create',{kind,school,owner,id,data,public_id},actor));
 }
 if(body.method==='update'&&actor.teacher){
 const groups=new Map<string,any>();for(const [raw,value]of Object.entries(body.data||{})){const p=raw.split('/').filter(Boolean);if(p.shift()!==root)throw{code:'media/permission'};if(['published','publishedWorks','audit','workAudit'].includes(p[0]))continue;if(!['works','submissions'].includes(p[0])||p.length!==5)throw{code:'media/permission'};const [k,s,o,i,f]=p;if(!actor.schools.includes(s)||!['status','revision','reviewedBy','reviewedAt','editedBy','editedAt','deletedAt',...(k==='works'?['title','introduction']:EDITABLE)].includes(f))throw{code:'media/permission'};const group=groups.get(p.slice(0,4).join('/'))||{kind:k,school:s,owner:o,id:i,patch:{}};group.patch[f]=value;groups.set(p.slice(0,4).join('/'),group);}
 if(groups.size!==1)throw{code:'media/permission'};for(const g of groups.values()){const rows=await access('read',g,actor);if(!rows[0])throw{code:'media/permission'};const data={...rows[0].data,...time(g.patch),reviewedBy:actor.uid,reviewedAt:Date.now()};let projection=null;if(data.status==='approved')projection=g.kind==='works'?publicWork(data,rows[0].public_id||('p_'+await digestBytes(new TextEncoder().encode(`${g.school}_${g.owner}_${g.id}`))),Date.now()):Object.fromEntries(publicFields.filter(k=>k in data).map(k=>[k,data[k]]));await access('review',{...g,data,projection},actor);}return json({ok:true});
 }
 throw{code:'media/permission'};
 }catch(e:any){const code=/^(media|auth)\/[a-z-]+$/.test(e?.code||'')?e.code:'media/invalid-request';const status=code.startsWith('auth/')?401:code.includes('quota')?429:code.includes('permission')?403:400;return json({code,message:status===429?'오늘 또는 잠시 동안의 제출 한도에 도달했어요. 선생님께 확인해주세요.':status===403?'연결 권한이 없거나 새 업로드가 일시 중단되었어요.':'요청·연결 상태를 확인해주세요.'},status);}
});