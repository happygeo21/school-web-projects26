import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {teacherAuthFailure} from '../teacher-login.js';

test('database request budget failure is not mislabeled as failed Google authentication',()=>{
 const result=teacherAuthFailure({code:'media/quota-full'},{stage:'database'});
 assert.equal(result.code,'media/quota-full');
 assert.match(result.message,/로그인.*성공/);
 assert.match(result.message,/일일 조회 요청 제한/);
 assert.match(result.message,/반복하지/);
});
test('live database polling is bounded, background-aware and backs off on failure',async()=>{
 const source=await readFile(new URL('../v2-database.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/setInterval\(poll,30000\)/);
 assert.match(source,/120000/);
 assert.match(source,/15\*60\*1000/);
 assert.match(source,/visibilitychange/);
 assert.match(source,/inFlight/);
 assert.match(source,/removeEventListener\('v2-data-change',refresh\)/);
});
test('Google popups start in the original click gesture when no sign-out is required',async()=>{
 const login=await readFile(new URL('../teacher-login.js',import.meta.url),'utf8');
 const teacher=await readFile(new URL('../teacher.html',import.meta.url),'utf8');
 const legacy=await readFile(new URL('../legacy-readonly.js',import.meta.url),'utf8');
 assert.match(login,/const preparation=prepare\(\);/);
 assert.match(login,/if\(preparation&&typeof preparation.then==='function'\)await preparation/);
 assert.match(teacher,/prepare:\(\)=>auth.currentUser\?\.isAnonymous\?signOut\(auth\):undefined/);
 assert.match(legacy,/const login=signInWithPopup\(auth,provider\)/);
 assert.doesNotMatch(legacy,/await setPersistence\(auth,inMemoryPersistence\);const provider=new GoogleAuthProvider/);
});
