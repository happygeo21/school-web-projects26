import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'_site');
const {files}=JSON.parse(await readFile(path.join(root,'scripts/public-files.json'),'utf8'));
const allowed=new Set(files);
async function walk(dir,prefix=''){
 const result=[];
 for(const name of await readdir(dir)){
  const relative=path.posix.join(prefix,name),stat=await lstat(path.join(dir,name));
  assert(!stat.isSymbolicLink(),`Unexpected output symlink: ${relative}`);
  if(stat.isDirectory())result.push(...await walk(path.join(dir,name),relative));
  else result.push(relative);
 }
 return result;
}
assert.deepEqual((await walk(out)).sort(),[...allowed].sort(),'Output must exactly match the public manifest');
for(const file of files){
 const source=await readFile(path.join(root,file)),published=await readFile(path.join(out,file));
 assert(source.equals(published),`Output changed source bytes: ${file}`);
 if(!file.endsWith('.html'))continue;
 const html=published.toString('utf8');
 for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const link=match[1].split(/[?#]/)[0];
  if(!link||/^[a-z]+:|^\/\//i.test(link)||link.startsWith('/')||link.includes('${'))continue;
  let target=path.posix.normalize(path.posix.join(path.posix.dirname(file),link));
  if(link.endsWith('/'))target=path.posix.join(target,'index.html');
  // Check bundled references that exist in this repository. Pre-existing external
  // or absent links are not silently added to the public artifact.
  let exists=false;try{exists=(await lstat(path.join(root,target))).isFile();}catch(e){if(e.code!=='ENOENT')throw e;}
  if(exists)assert(allowed.has(target),`Local link omitted from artifact: ${file} -> ${target}`);
 }
}
for(const internal of ['.git','.github','docs','wedding-planner/worker','wedding-planner/functions','wedding-planner/firestore.rules']){
 assert(!files.some(file=>file===internal||file.startsWith(internal+'/')),`Internal path published: ${internal}`);
}
console.log(`Verified ${files.length} public files: exact manifest, byte equality and bundled HTML references.`);
