// Review only. No account, Rules, database, or deployment mutation.
export const V2_PRODUCTION_LIMITS=Object.freeze({storageBytes:67108864,transferBytesMonth:500000000,filesPerUIDDay:3,filesPerProjectDay:20,requestsPerMinute:240,requestsPerDay:5000});
const fail=message=>{throw Error('V2 production review: '+message)};
export function validateProductionV2(c){
 if(c.projectId!=='school-project-26-1edf4')fail('existing teacher Auth project mismatch');
 if(c.databaseURL?.replace(/\/$/,'')!=='https://school-project-26-1edf4-default-rtdb.asia-southeast1.firebasedatabase.app')fail('legacy read target mismatch');
 if(c.supabaseURL?.replace(/\/$/,'')!=='https://pwedcxqkjolntwylgoyr.supabase.co')fail('Seoul V2 storage target mismatch');
 if(!Array.isArray(c.teachers)||c.teachers.length!==7||new Set(c.teachers).size!==7||c.teachers.some(x=>typeof x!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(x)))fail('seven unique existing teachers required');
 if(!c.schools||typeof c.schools!=='object'||Array.isArray(c.schools)||Object.keys(c.schools).length!==7||Object.keys(c.schools).some(x=>!c.teachers.includes(x)))fail('explicit school map for all seven teachers required');
 for(const uid of c.teachers){const schools=c.schools[uid];if(!Array.isArray(schools)||!schools.length||new Set(schools).size!==schools.length||schools.some(s=>!/^S[1-7]$/.test(s)))fail('invalid or missing teacher school scope');}
 if(!Array.isArray(c.admins)||c.admins.length)fail('no global administrator grants allowed');
 if(!Array.isArray(c.origins)||c.origins.length!==1||c.origins[0]!=='https://veteransgeo-live-v2.pages.dev')fail('V2-only exact Origin required');
 if(c.uploadMode!=='moderated-open')fail('no activity code or invite authentication in V2');
 if(c.policyApproved!=='approved')fail('school privacy and publication approval missing');
 if(c.authReuseApproved!=='approved')fail('existing Firebase Auth reuse including new anonymous identities requires approval');
 if(c.usageLimitsApproved!=='approved')fail('class capacity and free usage limits require approval');
 if(c.retentionMode!=='teacher-selected-delete')fail('retention decision missing');
 return Object.freeze({...c,supabaseURL:c.supabaseURL.replace(/\/$/,''),origin:c.origins[0],bucket:'veterans-v2-private',root:'veteransgeoLiveV2',limits:V2_PRODUCTION_LIMITS});
}
