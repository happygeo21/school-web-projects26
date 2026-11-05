// Synthetic principals only. Do not insert real teacher identifiers into this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createInvitePolicy } from "../server/invite-policy.mjs";
import { createUploadAccess } from "../server/upload-access.mjs";
import { createGateway } from "../server/gateway.mjs";
import { createMockMedia } from "./mock-media.mjs";
import { inviteDatabase } from "./invite-fixture.mjs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { createAdapters } from "../server/supabase-adapter.mjs";
import { rehearsalTargets } from "../server/rehearsal-target.mjs";
import { serverKeyFromEnvironment } from "../server/supabase-key.mjs";
const teachers = ["fixture-a", "fixture-peer", "fixture-b", "fixture-admin", "fixture-unassigned"];
const schools = { "fixture-a": ["S1"], "fixture-peer": ["S1"], "fixture-b": ["S2"] };
const policy = () => createInvitePolicy({ teachers, schools, admins: ["fixture-admin"] });

test("private policy: no implicit admin or default school, explicit admin requires approved account, immutable assignments", () => {
  const input = { ...schools, "fixture-a": ["S1"] }, p = createInvitePolicy({ teachers, schools: input });
  input["fixture-a"].push("S2");
  assert.deepEqual(p.actor("fixture-a").schools, ["S1"]);
  for (const uid of ["fixture-admin", "fixture-unassigned", "fixture-outsider"])
    assert.throws(() => p.actor(uid), { code: "media/permission" });
  assert.equal(policy().actor("fixture-admin").admin, true);
  for (const value of [{ teachers, admins: ["fixture-outsider"] }, { teachers, schools: { "fixture-a": ["S8"] } }, { teachers, schools: { "fixture-outsider": ["S1"] } }])
    assert.throws(() => createInvitePolicy(value), /Invalid private invite policy/);
});

test("test Edge entry: exact projects, private settings required, sanitized parsing, no network or account changes", async () => {
  const src=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/media/index.ts',import.meta.url),'utf8'))
    .replace(/^import[\s\S]*?from\s+["'][^"'\n]+["'];?\s*/gm,'');
  const config={FIREBASE_PROJECT_ID:'veteransgeo-test-2026',FIREBASE_DATABASE_URL:'https://veteransgeo-test-2026-default-rtdb.asia-southeast1.firebasedatabase.app',SUPABASE_URL:'https://jfkjuhxkcctfmwojhpci.supabase.co',SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_'+'X'.repeat(30)}),APPROVED_TEACHER_UIDS:JSON.stringify(['fixture-entry']),SCHOOL_ACTIVITY_HASHES:'{}',ALLOWED_ORIGINS:'["http://localhost:8765"]',UPLOAD_AUTH_MODE:'teacher-invite-link',INVITE_TEACHER_SCHOOLS:JSON.stringify({'fixture-entry':['S1']})};
  function run(patch={}) {
    let served=false;
    const env={...config,...patch};
    vm.runInNewContext(src,{createGateway,createAdapters,rehearsalTargets,serverKeyFromEnvironment,
      verifyFirebaseToken:()=>{throw Error('No network expected');},Deno:{env:{get:k=>env[k]},serve:()=>{served=true;}}});
    return served;
  }
  assert.equal(run(),true);
  assert.throws(()=>run({SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co'}),/Exact existing rehearsal projects/);
  assert.throws(()=>run({FIREBASE_PROJECT_ID:'school-project-26-1edf4',FIREBASE_DATABASE_URL:'https://school-project-26-1edf4-default-rtdb.asia-southeast1.firebasedatabase.app'}));
  assert.throws(()=>run({INVITE_TEACHER_SCHOOLS:undefined}),/Invalid private server configuration/);
  assert.throws(()=>run({APPROVED_TEACHER_UIDS:'not-json-sensitive-placeholder'}),/Invalid private server configuration/);
  assert.throws(()=>run({INVITE_ADMIN_UIDS:'["unapproved-fixture"]'}),/Invalid private invite policy/);
});

test("PostgreSQL: assigned school issue/list, same-school other issuer revoke denied, own revoke and explicit admin only", async () => {
  const f = await inviteDatabase(), access = createUploadAccess(f.store, policy());
  try {
    const first = await access.issue({ schoolId: "S1" }, "fixture-a");
    const peer = await access.issue({ schoolId: "S1" }, "fixture-peer");
    const other = await access.issue({ schoolId: "S2" }, "fixture-b");
    await assert.rejects(access.issue({ schoolId: "S2" }, "fixture-a"), { code: "media/permission" });
    await assert.rejects(access.list("S2", "fixture-a"), { code: "media/permission" });
    assert.deepEqual((await access.list("S1", "fixture-a")).map(x => x.id), [first.id]);
    await assert.rejects(access.revoke(first.id, "fixture-peer"), { code: "media/permission" });
    await assert.rejects(access.revoke(first.id, "fixture-b"), { code: "media/permission" });
    assert.equal((await f.query("select revoked_at from public.veterans_upload_invites where id=$1", [first.id]))[0].revoked_at, null);
    const actor = policy().actor("fixture-a");
    await assert.rejects(f.store("issue", { school: "S1", teacher: "fixture-peer" }, actor), { code: "media/permission" });
    await assert.rejects(f.store("revoke", { id: peer.id, teacher: "fixture-peer" }, actor), { code: "media/permission" });
    await assert.rejects(f.store("list", { school: "S1", teacher: "fixture-a" }, null), { code: "media/permission" });
    const grant = await access.redeem(first.inviteToken, "fixture-student");
    await assert.rejects(f.store("check", { uid: "fixture-other-student", school: "S1", grant_hash: "a".repeat(64) }, { uid: "fixture-student", kind: "student" }), { code: "media/permission" });
    await access.revoke(first.id, "fixture-a");
    await assert.rejects(access.authorize(grant.grantToken, "fixture-student", "S1"), { code: "media/permission" });
    assert.equal((await access.list("S1", "fixture-admin")).length, 2);
    await access.revoke(peer.id, "fixture-admin");
    await access.revoke(other.id, "fixture-admin");
    const admin = await access.issue({ schoolId: "S7" }, "fixture-admin");
    assert.equal(admin.schoolId, "S7");
  } finally { await f.close(); }
});

test("gateway: verified caller wins over forged teacher/school/admin fields; missing assignment fails closed", async () => {
  const sql = await inviteDatabase(), env = createMockMedia();
  try {
    const gateway = createGateway({ ...env, ledger: sql.ledger, uploadInvites: sql.store,
      teachers, inviteTeacherSchools: schools, origins: [],
      verify: async uid => ({ sub: uid, firebase: { sign_in_provider: "password" } }),
    });
    const call = (body, uid = "fixture-a") => gateway(new Request("http://localhost/media", { method: "POST", headers: { Authorization: "Bearer " + uid, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    const spoof = { teacher: "fixture-admin", ownerUid: "fixture-admin", admin: true, actor: { uid: "fixture-admin", schools: ["S1","S2"], admin: true } };
    assert.equal((await call({ action: "invite-issue", schoolId: "S2", ...spoof })).status, 403);
    for (const uid of ["fixture-admin", "fixture-unassigned", "fixture-outsider"])
      assert.equal((await call({ action: "invite-issue", schoolId: "S1" }, uid)).status, 403);
    const issued = await (await call({ action: "invite-issue", schoolId: "S1", ...spoof })).json();
    assert.equal((await sql.query("select teacher_uid from public.veterans_upload_invites where id=$1", [issued.id]))[0].teacher_uid, "fixture-a");
    const response = await call({ action: "invite-list", schoolId: "S1" });
    const serialized = JSON.stringify(await response.json());
    assert.ok(!teachers.some(uid => serialized.includes(uid)) && !serialized.includes("hash"));
    assert.equal((await call({ action: "invite-revoke", id: issued.id, ...spoof }, "fixture-peer")).status, 403);
    assert.equal((await call({ action: "invite-revoke", id: issued.id })).status, 200);
  } finally { await sql.close(); }
});

test("first-install migration: nine synthetic existing media preserved, RLS/EXECUTE denied, collision rollback and old RPC absence", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public bool,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(metadata jsonb);");
    await db.exec(await readFile(new URL("../supabase/migrations/202610290001_private_media.sql", import.meta.url), "utf8"));
    for (let n = 1; n <= 9; n++) await db.query("insert into public.veterans_media(asset_id,school_id,owner_uid,work_id,object_key,size,content_type,sha256,state) values($1,'S1',$2,$3,$4,4,'image/jpeg',$5,'ready')", ["p_" + String(n).padStart(64,"0"), "synthetic-legacy-" + n, "legacy-" + n, "private/legacy-" + n, "a".repeat(64)]);
    const snapshot = async () => ({
      media: (await db.query("select * from public.veterans_media order by asset_id")).rows,
      bucket: (await db.query("select * from storage.buckets")).rows,
      functions: (await db.query("select p.proname,pg_get_functiondef(p.oid) as source from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'veterans_upload_access' order by p.proname")).rows,
    });
    const before = await snapshot(), migration = await readFile(new URL("../supabase/migrations/202610300001_upload_invites.sql", import.meta.url), "utf8");
    const preflight=await readFile(new URL("./upload-invites-preflight.sql",import.meta.url),"utf8");
    await db.exec(preflight);
    await db.exec(migration);
    assert.deepEqual(await snapshot(), before);
    assert.equal(before.media.length, 9);
    assert.equal((await db.query("select to_regprocedure('public.veterans_upload_access(text,jsonb)') as legacy")).rows[0].legacy, null);
    for (const role of ["anon","authenticated"]) {
      await db.exec("set role " + role);
      for (const name of ["invites","grants","claims"]) await assert.rejects(db.query("select * from public.veterans_upload_" + name), /permission denied/);
      await assert.rejects(db.query("select public.veterans_upload_access('list','{}','{}')"), /permission denied/);
      await db.exec("reset role");
    }
    const fn = (await db.query("select prosecdef,proconfig from pg_proc where oid='public.veterans_upload_access(text,jsonb,jsonb)'::regprocedure")).rows[0];
    assert.equal(fn.prosecdef, true); assert.ok(fn.proconfig.includes('search_path=""'));
    await assert.rejects(db.exec(migration), /invite_schema_conflict/);
    await db.exec("rollback");
    assert.deepEqual(await snapshot(), before);
    await assert.rejects(db.exec(preflight), /invite_schema_conflict/);
    await db.exec("rollback");
  } finally { await db.close(); }
});
