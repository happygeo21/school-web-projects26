import{getApps}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import{getAuth}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import{MEDIA_CONFIG}from'./media-config.js';import{readLegacyPublic}from'./legacy-readonly.js';
const v2Auth=()=>{const student=getApps().find(a=>a.name==='veteransgeo-v2-student');return student?getAuth(student):getAuth()};
const endpoint=MEDIA_CONFIG.endpoint,root='veteransgeoLiveV2';const changed=()=>dispatchEvent(new Event('v2-data-change'));
export const getDatabase=()=>({});export const ref=(_db,path='')=>({path});export const push=r=>{const key='v2-'+crypto.randomUUID().replaceAll('-','');return{key,path:r.path+'/'+key}};
async function call(path,method='get',data){let token='';try{token=await v2Auth().currentUser?.getIdToken()||'';}catch{}const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'v2-db',path:path||root,method,...(data===undefined?{}:{data})}),cache:'no-store',signal:AbortSignal.timeout(18000)});const result=await response.json();if(!response.ok)throw{code:result.code||'media/network',message:result.message};return result;}
export const get=async r=>{const v=await call(r.path);return{exists:()=>v!=null,val:()=>v}};
export const set=async(r,data)=>{if(r.path.includes('/submissions/')&&data)data={...data,status:'pending'};const value=await call(r.path,'set',data);changed();return value;};
export const update=async(r,data)=>{const value=await call(r.path,'update',data);changed();return value;};export const remove=()=>Promise.reject({code:'media/permission',message:'원본 기록 삭제는 이 화면에서 지원하지 않아요.'});
export async function reviewRecord(kind,school,owner,id,status){const path=`${root}/${kind}/${school}/${owner}/${id}`,before=(await get(ref(null,path))).val();if(!before)throw{code:'media/permission'};return update(ref(null,root),{[path+'/status']:status,[path+'/revision']:(before.revision||0)+1,[path+'/deletedAt']:status==='archived'?Date.now():null});}
// Realtime-like reads are HTTP POSTs. Keep them bounded on free hosting and do not poll hidden tabs.
export function onValue(r,fn,fail){
 let live=true,previous='',timer=null,inFlight=false,queued=false,failures=0;
 const hidden=()=>document.visibilityState==='hidden';
 const schedule=(wait)=>{clearTimeout(timer);if(live&&!hidden())timer=setTimeout(poll,wait);};
 async function poll(){
   if(!live||hidden())return;
   if(inFlight){queued=true;return;}
   inFlight=true;
   try{
     let data=await call(r.path);
     if(r.path===root+'/published'){
       try{
         const old=await readLegacyPublic();
         data={...Object.fromEntries(Object.entries(old).map(([k,v])=>['legacy:'+k,{...v,sourceVersion:'legacy'}])),...Object.fromEntries(Object.entries(data||{}).map(([k,v])=>[k,{...v,sourceVersion:'v2'}]))};
       }catch{document.dispatchEvent(new CustomEvent('legacy-read-error'));}
     }
     failures=0;
     const encoded=JSON.stringify(data);
     if(live&&encoded!==previous){previous=encoded;fn({exists:()=>data!=null,val:()=>data});}
   }catch(error){failures++;if(live)fail?.(error);}
   finally{
     inFlight=false;
     if(!live)return;
     if(queued){queued=false;schedule(250);return;}
     // Normal refresh every two minutes. Errors back off to 4, 8, then 15 minutes.
     schedule(failures?Math.min(15*60*1000,120000*2**Math.min(failures,3)):120000);
   }
 }
 const refresh=()=>{if(!live||hidden())return;if(inFlight)queued=true;else schedule(120);};
 const visibility=()=>{if(hidden())clearTimeout(timer);else refresh();};
 void poll();
 addEventListener('v2-data-change',refresh);
 document.addEventListener('visibilitychange',visibility);
 return()=>{live=false;clearTimeout(timer);removeEventListener('v2-data-change',refresh);document.removeEventListener('visibilitychange',visibility);};
}