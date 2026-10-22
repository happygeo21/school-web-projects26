import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('planner entry points contain only login portals; no private runtime can be published',async()=>{
 const expected=['guide.html','home-dashboard.html','index.html'];
 assert.deepEqual((await readdir(new URL('wedding-planner/',root))).sort(),expected);
 for(const file of expected){const text=await readFile(new URL('wedding-planner/'+file,root),'utf8');assert.match(text,/https:\/\/wedding-planner-private\.ksoundmin\.workers\.dev\//);assert(!/app\.notion\.com|notion\.site|homeplan-v1|recordForm|data-template=/.test(text));}
 const {files}=JSON.parse(await readFile(new URL('scripts/public-files.json',root),'utf8'));
 assert.deepEqual(files.filter(f=>f.startsWith('wedding-planner/')).sort(),expected.map(f=>'wedding-planner/'+f));
});
