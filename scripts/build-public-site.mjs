import {readFile,mkdir,copyFile,lstat,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'_site');
const {files}=JSON.parse(await readFile(path.join(root,'scripts/public-files.json'),'utf8'));
const paths=new Set(files);
if(paths.size!==files.length)throw Error('Duplicate public path');
const plannerPortals=new Set(['wedding-planner/index.html','wedding-planner/guide.html','wedding-planner/home-dashboard.html']);
for(const file of files)if(file.startsWith('wedding-planner/')&&!plannerPortals.has(file))throw Error('Private planner runtime cannot be published: '+file);
// The staging directory must be new: do not silently keep files from a previous build.
try{await access(out);throw Error('_site already exists; use a fresh checkout or choose a fresh build directory');}catch(e){if(e.code!=='ENOENT')throw e;}
for(const file of files){
 if(!file||file.includes('\\')||path.posix.normalize(file)!==file||file.startsWith('/')||file.startsWith('../')||file.split('/').some(p=>p.startsWith('.')&&file!=='.nojekyll')||/(^|\/)(node_modules|worker|functions|test|tests|private-data|student-data|personal-records|backup-private)(\/|$)/.test(file)||/\.(rules|toml|ya?ml|pem|key|env|map|lock)$/.test(file))throw Error('Disallowed public file: '+file);
 const source=path.join(root,file);
 let current=root;for(const part of file.split('/')){current=path.join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('Symlink not allowed: '+file);}
 if(!(await lstat(source)).isFile())throw Error('Not a file: '+file);
 if(file.startsWith('wedding-planner/')&&/\.(html|js|mjs)$/.test(file)){
  const text=await readFile(source,'utf8');
  if(/app\.notion\.com|notion\.site|homeplan-v1|data-template=|recordForm/.test(text))throw Error('Planner detail or private document link in public portal');
  if(!text.includes('https://wedding-planner-private.ksoundmin.workers.dev/'))throw Error('Planner portal must lead to authenticated server');
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|ntn_)[A-Za-z0-9_]{25,}/.test(text))throw Error('Credential pattern in public wedding file');
  if(/화정동|영암|무궁화|2027-02-25|양가 각 4명/.test(text))throw Error('Fixed personal plan in public wedding file');
 }
 await mkdir(path.dirname(path.join(out,file)),{recursive:true});await copyFile(source,path.join(out,file));
}
console.log(`Prepared ${files.length} explicitly allowed public files.`);
