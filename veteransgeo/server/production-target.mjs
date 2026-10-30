// Offline production review only. The rehearsal target guard remains unchanged.
const firebaseProject='school-project-26-1edf4';
const databaseHost=firebaseProject+'-default-rtdb.asia-southeast1.firebasedatabase.app';
const rehearsalRef='jfkjuhxkcctfmwojhpci';
const stop=()=>{throw Error('Production review configuration is incomplete or inconsistent');};
function endpoint(value){let u;try{u=new URL(value);}catch{stop();}if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/')stop();return u;}
export function productionTargets({projectId,databaseURL,supabaseURL,productionSupabaseRef,teachers,schoolUploadHashes,origins,policyApproved,retentionMode}){
 if(projectId!==firebaseProject)stop();const db=endpoint(databaseURL),sb=endpoint(supabaseURL);
 if(db.hostname!==databaseHost||!/^[a-z0-9]{20}$/.test(productionSupabaseRef||'')||productionSupabaseRef===rehearsalRef||sb.hostname!==productionSupabaseRef+'.supabase.co')stop();
 if(!Array.isArray(teachers)||teachers.length!==7||new Set(teachers).size!==7||!teachers.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x)))stop();
 if(!schoolUploadHashes||Object.keys(schoolUploadHashes).length!==7||!Array.from({length:7},(_,i)=>'S'+(i+1)).every(k=>/^[a-f0-9]{64}$/.test(schoolUploadHashes[k]||'')))stop();
 if(!Array.isArray(origins)||origins.length!==1||origins[0]!=='https://happygeo21.github.io')stop();
 if(policyApproved!=='approved'||retentionMode!=='teacher-selected-delete')stop();
 return Object.freeze({kind:'veteransgeo-production',testOnly:false,apiVersion:1,firebaseProjectId:firebaseProject,databaseHost:db.hostname,supabaseHost:sb.hostname,storageBucket:'veterans-private'});
}
// An approved storage location does not authorize deleting accepted student files.
export function preserveProductionFiles(ledger) {
  return {...ledger, list: async () => { throw {code:"media/permission", message:"운영 파일 삭제 정책은 별도 승인 후 적용합니다. 현재 파일을 보존합니다."}; }};
}
