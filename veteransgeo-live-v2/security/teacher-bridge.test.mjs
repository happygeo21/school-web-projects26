import test from 'node:test';import assert from 'node:assert/strict';import{generateKeyPairSync,sign}from'node:crypto';
import{teacherBridge}from'../server/teacher-bridge.mjs';
import{verifyFirebaseToken}from'../server/firebase-token.mjs';
const{privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256'};
const teachers=Array.from({length:7},(_,i)=>'fixture-'+i),schools=Object.fromEntries(teachers.map((u,i)=>[u,['S'+(i+1)]]));
const verify=teacherBridge({verifyToken:(t,o)=>verifyFirebaseToken(t,{...o,getKeys:async()=>[jwk]}),testProject:'veteransgeo-test-2026',legacyProject:'school-project-26-1edf4',teachers,schools});
function token(project,sub,provider){const now=Math.floor(Date.now()/1000);const a=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture'})).toString('base64url');const b=Buffer.from(JSON.stringify({aud:project,iss:'https://securetoken.google.com/'+project,sub,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:provider}})).toString('base64url');return a+'.'+b+'.'+sign('RSA-SHA256',Buffer.from(a+'.'+b),privateKey).toString('base64url')}
test('existing seven teachers accept signed email and Google tokens',async()=>{for(const u of teachers)for(const p of ['password','google.com'])assert.equal((await verify(token('school-project-26-1edf4',u,p))).sub,u)});
test('original anonymous identities never enter test storage',async()=>{await assert.rejects(verify(token('school-project-26-1edf4',teachers[0],'anonymous')))});
test('unregistered original teacher denied',async()=>{await assert.rejects(verify(token('school-project-26-1edf4','unregistered','google.com')))});
test('test anonymous student remains supported',async()=>{assert.equal((await verify(token('veteransgeo-test-2026','student','anonymous'))).sub,'student')});
test('third project and tampered signature denied',async()=>{await assert.rejects(verify(token('other','student','anonymous')));const t=token('school-project-26-1edf4',teachers[0],'password');await assert.rejects(verify(t.slice(0,-8)+'AAAAAAAA'))});
test('missing or broad school grants rejected',()=>{assert.throws(()=>teacherBridge({teachers,schools:{},testProject:'test',legacyProject:'old'}));assert.throws(()=>teacherBridge({teachers,schools:{...schools,[teachers[0]]:['S1','S2']},testProject:'test',legacyProject:'old'}))});
