import { test } from "node:test";
import assert from "node:assert/strict";
import { createGateway } from "../server/gateway.mjs";
import {
  digestBytes,
  quotaDecision,
  publicWork,
  validateMedia,
} from "../media-policy.js";
import { createMockMedia } from "./mock-media.mjs";
const origin = "http://localhost:8765";
async function fixture(options = {}) {
  const env = createMockMedia(options),
    activityCode = "TEST-ONLY",
    hash = await digestBytes(new TextEncoder().encode(activityCode));
  const gateway = createGateway({
    ...env,
    teachers: ["teacher"],
    schoolActivityHashes: Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => ["S" + (i + 1), hash]),
    ),
    origins: [origin],
    clock: options.clock,
    verify: async (token) => {
      if (!["student", "other", "teacher", "outsider"].includes(token))
        throw Error("auth");
      return {
        sub: token,
        firebase: {
          sign_in_provider:
            token === "teacher" || token === "outsider"
              ? "password"
              : "anonymous",
        },
      };
    },
  });
  const call = (body, token = "student") =>
    gateway(
      new Request(origin + "/media", {
        method: "POST",
        headers: {
          Origin: origin,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  async function upload({
    schoolId = "S1",
    id = "one",
    owner = "student",
    type = "image/jpeg",
    bytes = new Uint8Array([255, 216, 255, 0]),
    badHash = false,
  } = {}) {
    const asset =
      "p_" +
      (await digestBytes(
        new TextEncoder().encode(`${schoolId}_${owner}_${id}`),
      ));
    env.state.works.set(`${schoolId}/${owner}/${id}`, {
      schoolId,
      activityCode,
      status: "pending",
      submissionMode: "upload",
      mediaProvider: "gateway",
      mediaAssetId: asset,
      size: bytes.length,
      contentType: type,
      sha256: badHash ? "0".repeat(64) : await digestBytes(bytes),
      title: "가상 작품",
      facilityName: "가상 장소",
      type: "사진",
      introduction: "테스트 전용",
    });
    const response = await gateway(
      new Request(origin + "/media?action=upload", {
        method: "POST",
        headers: {
          Origin: origin,
          Authorization: "Bearer " + owner,
          "Content-Type": type,
          "X-School-Id": schoolId,
          "X-Work-Id": id,
          "X-Activity-Code": activityCode,
        },
        body: bytes,
      }),
    );
    return { response, asset };
  }
  const read = (id) =>
    gateway(
      new Request(origin + "/media?publicId=" + id, {
        headers: { Origin: origin },
      }),
    );
  return { ...env, gateway, call, upload, read };
}
test("mock contract: 7 schools, private ownership, no duplicate upload, teacher approval and immediate next-request revocation", async () => {
  const f = await fixture();
  for (let i = 1; i <= 7; i++) {
    const { response, asset } = await f.upload({
      schoolId: "S" + i,
      owner: i <= 3 ? "student" : "other",
      id: "work" + i,
    });
    // Mock owner quota is intentionally 3/day; use fresh synthetic UID by resetting dated rows for this 7-school routing check.
    if (i === 3 || i === 6)
      for (const r of f.state.rows.values())
        r.created_at = "2020-01-01T00:00:00Z";
    assert.equal(response.status, 200);
    assert.equal((await f.read(asset)).status, 403);
    const row = f.state.rows.get(asset),
      p = {
        action: "preview",
        schoolId: row.school_id,
        ownerUid: row.owner_uid,
        workId: row.work_id,
      };
    assert.equal((await f.call(p, "outsider")).status, 403);
    assert.equal((await f.call(p, "teacher")).status, 200);
    const w = f.state.works.get(
        `${row.school_id}/${row.owner_uid}/${row.work_id}`,
      ),
      pub = publicWork(w, asset, Date.now());
    f.state.published.set(asset, pub);
    const r = await f.read(asset);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.equal("storageObjectKey" in pub, false);
    assert.equal("activityCode" in pub, false);
    assert.equal("uid" in pub, false);
    f.state.published.delete(asset);
    assert.equal((await f.read(asset)).status, 403);
  }
  const before = f.state.objects.size;
  const first = f.state.rows.values().next().value;
  const retry = await f.upload({
    schoolId: first.school_id,
    owner: first.owner_uid,
    id: first.work_id,
  });
  assert.equal(retry.response.status, 200);
  assert.equal(f.state.objects.size, before);
  assert.equal(
    (
      await f.call(
        {
          action: "inspect",
          schoolId: "S1",
          ownerUid: "student",
          workId: "work1",
        },
        "bad-token",
      )
    ).status,
    401,
  );
});
test("mock contract: video, invalid signature/hash/size, quota thresholds, no unapproved public file", async () => {
  const f = await fixture();
  const video = new Uint8Array([
    0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109,
  ]);
  assert.equal(
    (await f.upload({ type: "video/mp4", bytes: video })).response.status,
    200,
  );
  assert.equal(
    (await f.upload({ id: "bad", bytes: new TextEncoder().encode("<svg/>") }))
      .response.status,
    400,
  );
  assert.equal(
    (await f.upload({ id: "hash", badHash: true })).response.status,
    400,
  );
  for (const [type, size] of [
    ["image/jpeg", 3 * 1024 ** 2 + 1],
    ["video/mp4", 15 * 1024 ** 2 + 1],
    ["application/pdf", 5 * 1024 ** 2 + 1],
    ["text/html", 10],
  ])
    assert.throws(() => validateMedia({ type, size }));
  assert.equal(quotaDecision(700, 1, "image/jpeg", 1000).warning, true);
  assert.throws(() => quotaDecision(899, 1, "video/mp4", 1000));
  assert.throws(() => quotaDecision(999, 2, "image/jpeg", 1000));
  const tiny = await fixture({ capacity: 3 });
  assert.equal((await tiny.upload()).response.status, 429);
  assert.equal(tiny.state.objects.size, 0);
});
test("mock contract: upload failure, retry, uncertain orphan and teacher-only reconciliation; DB outage never deletes", async () => {
  let now = Date.now();
  const f = await fixture({ clock: () => now });
  f.state.failPut = true;
  const first = await f.upload();
  assert.equal(first.response.status, 503);
  assert.equal(f.state.objects.size, 0);
  f.state.failPut = false;
  assert.equal((await f.upload()).response.status, 200);
  assert.equal(f.state.objects.size, 1);
  f.state.failReady = true;
  f.state.failDelete = true;
  const lost = await f.upload({ id: "lost" });
  assert.equal(lost.response.status, 503);
  assert.equal(f.state.rows.get(lost.asset).state, "uploading");
  now += 11 * 60000;
  f.state.failDelete = false;
  const repaired = await f.call({ action: "reconcile" }, "teacher");
  assert.equal((await repaired.json()).repaired, 1);
  assert.equal(f.state.rows.get(lost.asset).state, "ready");
  assert.equal((await f.call({ action: "reconcile" }, "student")).status, 403);
  f.state.works.delete("S1/student/lost");
  now += 2 * 86400000;
  f.state.failDB = true;
  assert.notEqual(
    (await f.call({ action: "reconcile" }, "teacher")).status,
    200,
  );
  assert.equal(f.state.rows.get(lost.asset).state, "ready");
  f.state.failDB = false;
  const cleaned = await f.call({ action: "reconcile" }, "teacher");
  assert.equal((await cleaned.json()).deleted, 1);
  assert.equal(f.state.rows.get(lost.asset).state, "deleted");
});

test("HTTP provider requires a ready ACK, reports progress, cancels without losing operation identity, and bounds offline RTDB waits", async () => {
  const { createMediaProvider } = await import("../media-provider.js");
  const { waitForAck } = await import("../media-policy.js");
  let payload = '{"state":"ready"}',
    hold = false,
    progress = [];
  const factory = () => ({
    upload: {},
    open() {},
    setRequestHeader() {},
    abort() {},
    send() {
      if (hold) return;
      queueMicrotask(() => {
        this.upload.onprogress({
          lengthComputable: true,
          loaded: 5,
          total: 10,
        });
        this.status = 200;
        this.responseText = payload;
        this.onload();
      });
    },
  });
  const provider = createMediaProvider(
    { enabled: true, endpoint: "https://mock.invalid/media" },
    { xhrFactory: factory },
  );
  const args = {
    file: new Blob(["test"], { type: "image/jpeg" }),
    schoolId: "S1",
    workId: "fixed-id",
    activityCode: "TEST",
    token: "synthetic-only",
    onProgress: (n) => progress.push(n),
  };
  assert.equal((await provider.upload(args)).state, "ready");
  assert.deepEqual(progress, [50]);
  payload = "<html>access protection</html>";
  await assert.rejects(provider.upload(args));
  payload = "null";
  await assert.rejects(provider.upload(args));
  hold = true;
  const controller = new AbortController(),
    operation = provider.upload({ ...args, signal: controller.signal });
  controller.abort();
  await assert.rejects(operation, (e) => e.code === "media/canceled");
  await assert.rejects(
    waitForAck(new Promise(() => {}), undefined, 5),
    (e) => e.code === "media/network",
  );
  const canceled = new AbortController();
  canceled.abort();
  await assert.rejects(
    waitForAck(Promise.resolve(), canceled.signal),
    (e) => e.code === "media/canceled",
  );
  assert.equal(await waitForAck(Promise.resolve("server-ack")), "server-ack");
});
