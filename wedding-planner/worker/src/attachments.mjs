// Files live in the already-authorized Notion Journal, never public GitHub or Firestore.
export const MAX_FILE_BYTES=5_000_000;
export const FILE_TYPES={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
const reply=(status,code,extra={})=>Response.json({code,...extra},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export async function limitedBytes(body,max,signal){
 const reader=body?.getReader();if(!reader)throw Error('empty');let size=0;const chunks=[];
 const abort=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
 try{for(;;){if(signal?.aborted)throw Error('timeout');const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('large');chunks.push(value);}if(signal?.aborted)throw Error('timeout');const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;}finally{signal?.removeEventListener('abort',abort);reader.cancel().catch(()=>{});}
}
export function validateFile(name,bytes){
 name=name.normalize('NFC').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 if(!name||name.length>120||!bytes.length||bytes.length>MAX_FILE_BYTES)throw Error('invalid-file');
 const ext=name.split('.').pop().toLowerCase(),mime=FILE_TYPES[ext];if(!mime)throw Error('file-type');
 const starts=(...s)=>s.every((b,i)=>bytes[i]===b),ascii=new TextDecoder().decode(bytes.slice(0,12));
 if((['jpg','jpeg'].includes(ext)&&!starts(255,216,255))||(ext==='png'&&!starts(137,80,78,71,13,10,26,10))||(ext==='webp'&&!(ascii.startsWith('RIFF')&&ascii.slice(8)==='WEBP'))||(ext==='pdf'&&!ascii.startsWith('%PDF-'))||(['docx','xlsx','pptx'].includes(ext)&&!starts(80,75,3,4))||(['doc','xls','ppt'].includes(ext)&&!starts(208,207,17,224,161,177,26,225)))throw Error('file-type');
 if(['txt','csv'].includes(ext)){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))throw Error();}catch{throw Error('file-type');}}
 return {name,mime,size:bytes.length};
}
export async function attachmentGateway(request,env,validToken){
 const origin=request.headers.get('Origin'),path=new URL(request.url).pathname;
 if(origin!==env.ALLOWED_ORIGIN)return reply(403,'origin-denied');
 let response;
 if(!['/attachments/list','/attachments/upload','/attachments/download'].includes(path))response=reply(404,'not-found');
 else if(request.method==='OPTIONS')response=new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Record-Id, X-Record-Revision, X-Attachment-Id, X-File-Name','Access-Control-Max-Age':'600'}});
 else if(request.method!=='POST')response=reply(405,'method-not-allowed');
 else if(!validToken(request.headers.get('Authorization'),env.FIREBASE_PROJECT_ID))response=reply(401,'login-required');
 else if(!env.WEDDING_NOTION_TOKEN||!env.SYNC_STATE)response=reply(503,'setup-required');
 else{const id=request.headers.get('X-Record-Id'),revision=Number(request.headers.get('X-Record-Revision'));
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id||'')||!Number.isSafeInteger(revision)||revision<1)response=reply(400,'invalid-request');
  else try{response=await env.SYNC_STATE.get(env.SYNC_STATE.idFromName('private-wedding-journal-v1')).fetch(new Request('https://internal'+path,request));}catch{response=reply(503,'attachment-unavailable');}
 }
 const out=new Response(response.body,response);out.headers.set('Access-Control-Allow-Origin',origin);out.headers.set('Vary','Origin');out.headers.set('Cache-Control','no-store');out.headers.set('X-Content-Type-Options','nosniff');return out;
}
export async function handleAttachment(request,storage,env){
 const signal=AbortSignal.timeout(22000),id=request.headers.get('X-Record-Id'),revision=Number(request.headers.get('X-Record-Revision')),action=new URL(request.url).pathname.split('/').pop();
 // Every list/upload/download revalidates Firebase membership; metadata is never an authorization grant.
 let source;try{source=await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/records/${id}`,{headers:{Authorization:request.headers.get('Authorization')},signal});}catch{return reply(503,'source-unavailable');}
 if(!source.ok)return reply(source.status===429?429:403,source.status===429?'quota-exceeded':'access-denied');
 const doc=await source.json();if(Number(doc.fields?.revision?.integerValue)!==revision)return reply(409,'record-changed');
 const mapping=await storage.get(`record:${id}`),files=await storage.get(`files:${id}`)||[];
 if(action==='list')return reply(200,'listed',{files:files.map(({blockId,name,mime,size})=>({id:blockId,name,mime,size})),pageId:mapping?.pageId||null});
 if(!mapping?.pageId||mapping.state!=='done')return reply(409,'send-record-first');
 const attempt=request.headers.get('X-Attachment-Id');if(!uuid(attempt))return reply(400,'invalid-request');
 const headers={Authorization:`Bearer ${env.WEDDING_NOTION_TOKEN}`,'Notion-Version':'2025-09-03'};
 const notion=(path,init={})=>fetch('https://api.notion.com/v1/'+path,{...init,headers:{...headers,...init.headers},signal});
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 if(action==='download'){
  const file=files.find(f=>f.blockId===attempt);if(!file)return reply(404,'attachment-not-found');
  const u=await storage.get('fileReads')||{},count=u.day===day?u.count:0;if(count>=500)return reply(429,'attachment-read-limit');
  await storage.put('fileReads',{day,count:count+1});
  let stage='metadata';try{const r=await notion('blocks/'+file.blockId);if(!r.ok)return reply(503,'attachment-metadata-failed');const block=await r.json(),media=block[block.type];
   if(block.archived||block.in_trash||(block.parent?.page_id||'').replaceAll('-','')!==mapping.pageId.replaceAll('-','')||media?.type!=='file')return reply(404,'attachment-not-found');
   const url=new URL(media.file.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.amazonaws.com')||url.username||url.password)return reply(503,'attachment-host-changed');
   stage='storage';const content=await fetch(url,{signal,redirect:'manual'});if(!content.ok)return reply(503,'attachment-storage-failed');stage='download';const bytes=await limitedBytes(content.body,MAX_FILE_BYTES,signal);
   // Images alone can be previewed. Documents are downloaded as inert binary, never embedded HTML.
   stage='validation';validateFile(file.name,bytes);
   return new Response(bytes,{headers:{'Content-Type':file.mime.startsWith('image/')?file.mime:'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return reply(503,'attachment-read-failed',{stage});}
 }
 if(action!=='upload')return reply(404,'not-found');
 const key=`fileOp:${id}:${attempt}`,previous=await storage.get(key);
 if(previous?.state==='done')return reply(200,'already-uploaded');
 if(previous?.state==='attaching'||previous?.state==='uncertain')return reply(409,'check-notion-attachment');
 if(files.length>=20)return reply(409,'attachment-count-limit');
 let bytes,meta;try{bytes=await limitedBytes(request.body,MAX_FILE_BYTES,signal);meta=validateFile(decodeURIComponent(request.headers.get('X-File-Name')||''),bytes);}catch{return reply(400,'invalid-file');}
 const u=await storage.get('fileUploads')||{},count=u.day===day?u.count:0;
 if(count>=40)return reply(429,'attachment-daily-limit');
 if(now-(u.lastAttempt||0)<1500)return reply(429,'attachment-slow-down');
 await storage.put('fileUploads',{day,count:count+1,lastAttempt:now});
 let attaching=false;
 try{
  const create=await notion('file_uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'single_part',filename:meta.name,content_type:meta.mime})});
  if(!create.ok)return reply(503,'attachment-rejected');const upload=await create.json();if(!uuid(upload.id))return reply(503,'attachment-rejected');
  const form=new FormData();form.append('file',new Blob([bytes],{type:meta.mime}),meta.name);
  const send=await notion(`file_uploads/${upload.id}/send`,{method:'POST',body:form});if(!send.ok||(await send.json()).status!=='uploaded')return reply(503,'attachment-rejected');
  await storage.put(key,{state:'attaching'});attaching=true;
  const type=meta.mime.startsWith('image/')?'image':'file';
  const append=await notion(`blocks/${mapping.pageId}/children`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({children:[{object:'block',type,[type]:{type:'file_upload',file_upload:{id:upload.id},caption:[{type:'text',text:{content:meta.name}}]}}]})});
  if(!append.ok){await storage.put(key,{state:append.status<500?'rejected':'uncertain'});return reply(503,append.status<500?'attachment-rejected':'check-notion-attachment');}
  const block=(await append.json()).results?.[0];if(!uuid(block?.id))throw Error('missing-block');
  // Persist only file metadata/IDs, no file bytes, signed links, tokens or record text.
  await storage.put({[`files:${id}`]:[...files,{...meta,blockId:block.id}],[key]:{state:'done',blockId:block.id}});
  return reply(200,'uploaded');
 }catch{if(attaching)await storage.put(key,{state:'uncertain'});return reply(503,attaching?'check-notion-attachment':'attachment-rejected');}
}
