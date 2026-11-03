import test from'node:test';import assert from'node:assert/strict';import{validateProductionV2,V2_PRODUCTION_LIMITS}from'../server/production-v2-config.mjs';
const fixture=()=>{const teachers=Array.from({length:7},(_,i)=>'fixture-teacher-'+i);return{projectId:'school-project-26-1edf4',databaseURL:'https://school-project-26-1edf4-default-rtdb.asia-southeast1.firebasedatabase.app',supabaseURL:'https://pwedcxqkjolntwylgoyr.supabase.co',teachers,schools:Object.fromEntries(teachers.map((u,i)=>[u,i===0?['S1','S2','S3','S4','S5','S6','S7']:['S'+(i+1)]])),admins:[teachers[0]],origins:['https://veteransgeo-live-v2.pages.dev'],uploadMode:'moderated-open',policyApproved:'approved',authReuseApproved:'approved',usageLimitsApproved:'approved',retentionMode:'teacher-selected-delete'}};
test('fully explicit synthetic review configuration preserves V2 separation and conservative caps',()=>{const c=validateProductionV2(fixture());assert.equal(c.root,'veteransgeoLiveV2');assert.equal(c.bucket,'veterans-v2-private');assert.equal(c.admins.length,1);assert.equal(c.schools[c.admins[0]].length,7);assert.equal(c.limits,V2_PRODUCTION_LIMITS);});
for(const[key,value]of[['projectId','veteransgeo-test-2026'],['supabaseURL','https://jfkjuhxkcctfmwojhpci.supabase.co'],['origins',['https://happygeo21.github.io']],['admins',['fixture-not-approved']],['schools',{}],['uploadMode','teacher-invite-link'],['policyApproved','pending-school-confirmation'],['authReuseApproved','pending'],['usageLimitsApproved','pending'],['retentionMode','automatic-delete']])test('release rejects '+key,()=>assert.throws(()=>validateProductionV2({...fixture(),[key]:value}),/V2 production review/));
test('missing or unapproved teacher and school assignments fail closed',()=>{for(const alter of[c=>c.teachers[1]=c.teachers[0],c=>c.schools[c.teachers[0]]=[],c=>c.schools[c.teachers[1]]=['S8'],c=>c.schools.extra=['S1']]){const c=fixture();alter(c);assert.throws(()=>validateProductionV2(c));}});

test('single highest administrator has seven school scopes but six teachers remain limited to one',()=>{
 const c=validateProductionV2(fixture());
 assert.deepEqual(new Set(c.schools[c.admins[0]]),new Set(['S1','S2','S3','S4','S5','S6','S7']));
 for(const uid of c.teachers)if(uid!==c.admins[0])assert.equal(c.schools[uid].length,1);
});
test('rejects additional administrators or accidental cross-school grants',()=>{
 for(const alter of [
   c=>{c.admins=[];},
   c=>{c.admins.push(c.teachers[1]);},
   c=>{c.schools[c.admins[0]]=['S1'];},
   c=>{c.schools[c.teachers[2]]=['S2','S3'];},
   c=>{c.admins=[c.teachers[6]];}
 ]){const c=fixture();alter(c);assert.throws(()=>validateProductionV2(c),/V2 production review/);}
});
