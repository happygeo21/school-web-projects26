import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteDatabase } from "./invite-fixture.mjs";
import { createUploadAccess } from "../server/upload-access.mjs";
import { createGateway } from "../server/gateway.mjs";
import { createMockMedia } from "./mock-media.mjs";
import { digestBytes } from "../media-policy.js";

test("local PostgreSQL: hashed tokens, school/UID/expiry checks, RLS and service-only RPC", async () => {
  const f = await inviteDatabase(), access = createUploadAccess(f.store);
  try {
    await assert.rejects(access.issue({ schoolId: "S1", minutes: 61 }, "teacher"));
    for (let n = 1; n <= 7; n++) {
      const invite = await access.issue({ schoolId: "S" + n }, "teacher");
      const grant = await access.redeem(invite.inviteToken, "student");
      assert.equal(grant.schoolId, "S" + n);
      await access.authorize(grant.grantToken, "student", grant.schoolId);
      await assert.rejects(access.authorize(grant.grantToken, "other", grant.schoolId), { code: "media/permission" });
      await assert.rejects(access.authorize(grant.grantToken, "student", n === 7 ? "S1" : "S7"), { code: "media/permission" });
      const stored = JSON.stringify(await f.query("select * from public.veterans_upload_invites"));
      assert.ok(!stored.includes(invite.inviteToken));
      await f.db.query("update public.veterans_upload_grants set expires_at=clock_timestamp()-interval '1 second' where owner_uid='student'");
      await assert.rejects(access.authorize(grant.grantToken, "student", grant.schoolId), { code: "media/permission" });
      await f.db.query("update public.veterans_upload_invites set expires_at=clock_timestamp()-interval '1 second' where id=$1", [invite.id]);
      await assert.rejects(access.redeem(invite.inviteToken, "student"), { code: "media/permission" });
    }
    for (const role of ["anon", "authenticated"]) {
      await f.db.exec("set role " + role);
      for (const table of ["invites", "grants", "claims"])
        await assert.rejects(f.query("select * from public.veterans_upload_" + table), /permission denied/);
      await assert.rejects(f.query("select public.veterans_upload_access('list','{}')"), /permission denied/);
      await f.db.exec("reset role");
    }
  } finally { await f.close(); }
});

test("local PostgreSQL: distinct-work quotas, concurrent requests, retry identity and atomic revoked commit", async () => {
  const f = await inviteDatabase(), access = createUploadAccess(f.store);
  try {
    const invite = await access.issue({ schoolId: "S1", perStudent: 2, total: 2, maxBytes: 100 }, "teacher");
    const grant = await access.redeem(invite.inviteToken, "student");
    const data = n => ({ work_id: "w" + n, asset_id: "p_" + String(n).padStart(64, "0"), size: 10, sha256: "a".repeat(64) });
    const claim = n => access.authorize(grant.grantToken, "student", "S1", data(n), "claim");
    const result = await Promise.allSettled([claim(1), claim(2), claim(3)]);
    assert.equal(result.filter(r => r.status === "fulfilled").length, 2);
    // Hashing/transaction scheduling may admit any two requests; never assume work 1 wins.
    const accepted = result.findIndex(r => r.status === "fulfilled") + 1;
    await claim(accepted); // Retry of an accepted work consumes no extra capacity.
    await assert.rejects(access.authorize(grant.grantToken, "student", "S1", { ...data(accepted), size: 11 }, "claim"), { code: "media/permission" });
    await assert.rejects(access.authorize(grant.grantToken, "student", "S1", { ...data(4), size: 101 }, "claim"), { code: "media/permission" });
    const other = await access.redeem(invite.inviteToken, "other");
    await assert.rejects(access.authorize(other.grantToken, "other", "S1", data(4), "claim"), { code: "media/quota-full" });
    await f.ledger.reserve({ ...data(accepted), school_id: "S1", owner_uid: "student", content_type: "image/jpeg" });
    await access.revoke(invite.id, "teacher");
    await assert.rejects(access.authorize(grant.grantToken, "student", "S1", data(accepted), "commit"), { code: "media/permission" });
    assert.equal((await f.ledger.find(data(accepted).asset_id)).state, "uploading");
    await assert.rejects(access.redeem(invite.inviteToken, "student"), { code: "media/permission" });
    const listing = JSON.stringify(await access.list("S1", "teacher"));
    assert.ok(!listing.includes("hash") && !listing.includes("student") && !listing.includes(invite.inviteToken));
  } finally { await f.close(); }
});

test("gateway + local PostgreSQL: teacher-only issue/revoke, no legacy-code fallback, count/byte checks, revocation during transfer and retry", async () => {
  const sql = await inviteDatabase(), env = createMockMedia();
  let revokeDuringPut = null;
  const gateway = createGateway({ ...env, ledger: sql.ledger, uploadInvites: sql.store,
    blobs: { ...env.blobs, put: async (...a) => { await env.blobs.put(...a); if (revokeDuringPut) await sql.store("revoke", { id: revokeDuringPut }); } },
    teachers: ["teacher"], origins: ["http://localhost:8000"], schoolUploadHashes: { S1: await digestBytes(new TextEncoder().encode("OLD")) },
    verify: async t => { if (!["teacher", "student", "other", "outsider"].includes(t)) throw Error(); return { sub: t, firebase: { sign_in_provider: ["teacher", "outsider"].includes(t) ? "password" : "anonymous" } }; },
  });
  const call = (data, uid = "student") => gateway(new Request("http://localhost:8000/media", { method: "POST", headers: { Authorization: "Bearer " + uid, "Content-Type": "application/json" }, body: JSON.stringify(data) }));
  const issue = async () => (await call({ action: "invite-issue", schoolId: "S1", maxBytes: 10, perStudent: 1 }, "teacher")).json();
  const redeem = async i => (await call({ action: "invite-redeem", inviteToken: i.inviteToken })).json();
  const upload = async (grant, { school = "S1", uid = "student", id = "one", size = 4 } = {}) => {
    const bytes = new Uint8Array(size); bytes.set([255, 216, 255]);
    const asset = "p_" + await digestBytes(new TextEncoder().encode(`${school}_${uid}_${id}`));
    env.state.works.set(`${school}/${uid}/${id}`, { schoolId: school, activityCode: "preserved", status: "pending", submissionMode: "upload", mediaProvider: "gateway", mediaAssetId: asset, size, contentType: "image/jpeg", sha256: await digestBytes(bytes) });
    return gateway(new Request("http://localhost:8000/media?action=upload", { method: "POST", headers: { Authorization: "Bearer " + uid, "X-School-Id": school, "X-Work-Id": id, "Content-Type": "image/jpeg", "X-Upload-Grant": grant || "", "X-Upload-Code": "OLD" }, body: bytes }));
  };
  try {
    for (const uid of ["student", "outsider"]) assert.equal((await call({ action: "invite-issue", schoolId: "S1" }, uid)).status, 403);
    const i = await issue(), g = await redeem(i);
    assert.equal((await call({ action: "invite-redeem", inviteToken: i.inviteToken }, "teacher")).status, 403);
    assert.equal((await upload(null)).status, 403);
    assert.equal((await upload(g.grantToken, { uid: "other" })).status, 403);
    assert.equal((await upload(g.grantToken, { school: "S2" })).status, 403);
    assert.equal((await upload(g.grantToken, { size: 11 })).status, 400);
    assert.equal((await upload(g.grantToken)).status, 200);
    assert.equal((await (await upload(g.grantToken)).json()).duplicate, true);
    assert.equal((await upload(g.grantToken, { id: "two" })).status, 429);
    assert.equal((await call({ action: "invite-revoke", id: i.id })).status, 403);
    assert.equal((await call({ action: "invite-revoke", id: i.id }, "teacher")).status, 200);
    assert.equal((await upload(g.grantToken)).status, 403);
    assert.equal(env.state.objects.size, 1); // A denied retry cannot erase a previously accepted work.
    const i2 = await issue(), g2 = await redeem(i2); revokeDuringPut = i2.id;
    assert.equal((await upload(g2.grantToken, { id: "mid-revoke" })).status, 403);
    assert.equal(env.state.objects.size, 1); // Newly staged file cleaned, old file preserved.
    const i3 = await issue(), g3 = await redeem(i3); revokeDuringPut = null;
    assert.equal((await upload(g3.grantToken, { id: "mid-revoke" })).status, 200);
    assert.equal(env.state.objects.size, 2);
    const stored = JSON.stringify([...env.state.works.values()]);
    assert.ok(!stored.includes(i.inviteToken) && !stored.includes(g.grantToken));
    const r = await call({ action: "invite-check", schoolId: "S1", grantToken: g.grantToken });
    assert.equal(r.headers.get("Referrer-Policy"), "no-referrer");
    assert.match(r.headers.get("Cache-Control"), /no-store/);
  } finally { await sql.close(); }
});
