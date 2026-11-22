// Review entry point only: deliberately outside supabase/functions. Not deployed by the rehearsal config.
// Do not copy into a deployment until the reviewed release and school data policy are approved.
import {createGateway} from './gateway.mjs';
import {verifyFirebaseToken} from './firebase-token.mjs';
import {createAdapters} from './supabase-adapter.mjs';
import {serverKeyFromEnvironment} from './supabase-key.mjs';
import {productionTargets,preserveProductionFiles} from './production-target.mjs';
const required=(key:string)=>{const value=Deno.env.get(key);if(!value||value.trim()!==value)throw Error('Invalid production configuration');return value;};
const projectId=required('FIREBASE_PROJECT_ID'),databaseURL=required('FIREBASE_DATABASE_URL'),supabaseURL=required('SUPABASE_URL');
const teachers=JSON.parse(required('APPROVED_TEACHER_UIDS')),schoolUploadHashes=JSON.parse(required('SCHOOL_UPLOAD_AUTH_HASHES')),origins=JSON.parse(required('ALLOWED_ORIGINS'));
const deployment=productionTargets({projectId,databaseURL,supabaseURL,productionSupabaseRef:required('PRODUCTION_SUPABASE_REF'),teachers,schoolUploadHashes,origins,policyApproved:required('STUDENT_DATA_POLICY_APPROVED'),retentionMode:required('STUDENT_FILE_RETENTION_MODE')});
// User-approved policy: keep files until a teacher selects deletion. No automatic expiry.
// Destructive reconciliation stays blocked; deployment does not authorize deleting existing files.
const adapters=createAdapters({supabaseURL,serviceKey:serverKeyFromEnvironment((key:string)=>Deno.env.get(key)),bucket:deployment.storageBucket,databaseURL});
Deno.serve(createGateway({...adapters,ledger:preserveProductionFiles(adapters.ledger),teachers,schoolUploadHashes,origins,deployment,verify:(token:string)=>verifyFirebaseToken(token,{projectId})}));