// Offline aggregate audit. Inputs stay outside Git; no Firebase requests or record values in output.
import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateRecord} from '../upgrade-core.js';
const checkout=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function privateInput(file){const p=await realpath(file);if(p===checkout||p.startsWith(checkout+path.sep))throw Error('Private input must stay outside the checkout');return p;}
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const equal=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
export function auditSnapshot(snapshot,current,candidate){
 const required=['createdAt','schoolId','activityCode','category','placeName','address','latitude','longitude','officialStatus','awarenessScore','importance','visibility','scoreReason','sourceType','sourceNote','rememberSentence','message','keywords','placeDescription','placeOrigin'];
 const numbers=new Set(['createdAt','latitude','longitude','awarenessScore','importance','visibility']);
 const report={kind:'offline-production-aggregate',complete:true,schools:{},total:0,missingAwarenessOriginal:0,oldOrMissingSchemaVersion:0,missingRequiredRecords:0,typeErrorRecords:0,newClientValidationFailures:0,errors:{},publicKeys:{total:Object.keys(snapshot.published||{}).length,legacy:0,opaque:0,unrecognized:0,collisions:0,dualKeys:0,unmatched:0},otherRulesPreserved:true};
 const hit=key=>report.errors[key]=(report.errors[key]||0)+1;const expected=new Map();
 for(let n=1;n<=7;n++)report.schools['S'+n]={submissions:0,missingAwarenessOriginal:0,oldOrMissingSchemaVersion:0,missingRequiredRecords:0,typeErrorRecords:0,newClientValidationFailures:0};
 for(const [school,users] of Object.entries(snapshot.submissions||{})){if(!/^S[1-7]$/.test(school)){hit('unknown-school-path');report.complete=false;continue;}for(const [uid,records] of Object.entries(users||{}))for(const [id,d]of Object.entries(records||{})){
  const row=report.schools[school];report.total++;row.submissions++;
  if(!d||typeof d!=='object'||Array.isArray(d)){hit('non-object-record');report.complete=false;continue;}
  if(!d.awarenessOriginal){report.missingAwarenessOriginal++;row.missingAwarenessOriginal++;}
  if(d.schemaVersion!==2){report.oldOrMissingSchemaVersion++;row.oldOrMissingSchemaVersion++;}
  let missing=false,type=false;for(const key of required){if(!Object.hasOwn(d,key)){hit('missing:'+key);missing=true;}else if(typeof d[key]!== (numbers.has(key)?'number':'string')||(numbers.has(key)&&!Number.isFinite(d[key]))){hit('type:'+key);type=true;}}
  if(d.schoolId!==school){hit('school-path-mismatch');type=true;}
  if(d.awarenessOriginal&&(typeof d.awarenessOriginal!=='object'||typeof d.awarenessOriginal.score!=='number'||typeof d.awarenessOriginal.capturedAt!=='number'||typeof d.awarenessOriginal.placeName!=='string'||d.awarenessOriginal.timing!=='before-exploration')){hit('awareness-original-shape');type=true;}
  if(missing){report.missingRequiredRecords++;row.missingRequiredRecords++;}if(type){report.typeErrorRecords++;row.typeErrorRecords++;}
  try{validateRecord(d);}catch{report.newClientValidationFailures++;row.newClientValidationFailures++;}
  const legacy=school+'_'+uid+'_'+id,opaque='p_'+createHash('sha256').update(legacy).digest('hex');
  if(expected.has(opaque)&&expected.get(opaque)!==legacy)report.publicKeys.collisions++;expected.set(opaque,legacy);expected.set(legacy,legacy);
  if(snapshot.published?.[legacy]&&snapshot.published?.[opaque])report.publicKeys.dualKeys++;
 }}
 for(const key of Object.keys(snapshot.published||{})){if(/^p_[a-f0-9]{64}$/.test(key))report.publicKeys.opaque++;else if(/^S[1-7]_/.test(key))report.publicKeys.legacy++;else report.publicKeys.unrecognized++;if(!expected.has(key))report.publicKeys.unmatched++;}
 report.otherRules=Object.keys(current.rules).filter(k=>k!=='memoryTemperature2026').map(k=>({path:k,equivalent:equal(current.rules[k],candidate.rules[k])}));report.otherRulesPreserved=report.otherRules.every(x=>x.equivalent);
 report.compatibility={oldWebOldRules:'existing-format-accepted; no new original-protection guarantee',newWebOldRules:'blocked: own read and new work/audit paths absent',oldWebNewRules:'blocked: new submissions require awarenessOriginal',newWebNewRules:'requires emulator legacy edit and authorization acceptance'};
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [snapshotFile,currentFile,candidateFile,out]=process.argv.slice(2);if(!out)throw Error('Four private file arguments required');const inputs=await Promise.all([snapshotFile,currentFile,candidateFile].map(async f=>JSON.parse(await readFile(await privateInput(f),'utf8'))));const outputDir=await realpath(path.dirname(path.resolve(out)));if(outputDir===checkout||outputDir.startsWith(checkout+path.sep))throw Error('Private report must stay outside checkout');const result=auditSnapshot(...inputs);await writeFile(path.join(outputDir,path.basename(out)),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));}catch{console.error('Private aggregate audit failed; no input values logged');process.exitCode=1;}
}