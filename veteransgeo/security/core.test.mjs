import * as fsForPrivateTest from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateRecord,
  checkFile,
  coordinates,
  errorMessage,
  externalLink,
} from "../upgrade-core.js";
import { verifiedFacilities } from "../official-facilities.js";
test("file boundaries, invalid MIME and coordinates are rejected", () => {
  for (const [type, max] of [
    ["image/jpeg", 3145728],
    ["video/mp4", 15728640],
    ["application/pdf", 5242880],
  ]) {
    assert.doesNotThrow(() => checkFile({ type, size: max }));
    assert.throws(() => checkFile({ type, size: max + 1 }));
  }
  assert.throws(() => checkFile({ type: "image/svg+xml", size: 1 }));
  for (const p of [
    [127, 36],
    [NaN, 127],
    ["36", 127],
    [0, 0],
  ])
    assert.equal(coordinates(...p), false);
  assert.equal(coordinates(36, 127), true);
});
test("unverified official cache cannot appear official; swapped coordinates fail", () => {
  assert.deepEqual(
    verifiedFacilities({
      status: "awaiting-verified-source",
      facilities: [{ name: "가상" }],
    }),
    [],
  );
  const cache = {
    schemaVersion: 1,
    status: "verified",
    updatedAt: "2026-10-29",
    crs: "EPSG:4326",
    license: "TEST ONLY",
    coordinateMapping: "fixture latitude longitude",
    facilities: [
      {
        id: "fixture",
        name: "가상",
        address: "가상",
        region: "가상",
        verified: true,
        latitude: 36,
        longitude: 127,
        sourceUrl: "https://mfis.mpva.go.kr/fixture",
      },
    ],
  };
  assert.equal(verifiedFacilities(cache).length, 1);
  cache.facilities[0].latitude = 127;
  cache.facilities[0].longitude = 36;
  assert.equal(verifiedFacilities(cache).length, 0);
});
test("permission, auth and network errors have separate student explanations", () => {
  assert.match(errorMessage({ code: "PERMISSION_DENIED" }), /저장 권한/);
  assert.match(
    errorMessage({ code: "auth/operation-not-allowed" }),
    /학생 연결/,
  );
  assert.match(errorMessage({ code: "network-timeout" }), /연결이 불안정/);
});

test("external links reject scripts, lookalike hosts and embedded credentials", () => {
  assert.equal(
    externalLink("https://drive.google.com/file/d/fictional/view"),
    "https://drive.google.com/file/d/fictional/view",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://drive.google.com.evil.test/file",
    "https://u:p@drive.google.com/file",
    "http://drive.google.com/file",
  ])
    assert.throws(() => externalLink(url));
});

import { draftStore, opaquePublicId, DRAFT_TTL } from "../draft-store.js";
import { buildCache } from "./update-facility-cache.mjs";
import { createHash } from "node:crypto";
test("tab drafts restore exact frozen payload, expire, reject corruption and fail closed on unavailable storage", () => {
  const values = new Map();
  const memory = {
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  let time = 1000;
  const store = draftStore(memory, "test", () => time);
  const draft = {
    pending: {
      owner: "fictional",
      key: "same-id",
      data: { createdAt: 100, placeName: "가상" },
    },
  };
  assert.equal(store.save(draft), true);
  assert.deepEqual(store.read().pending, draft.pending);
  time += DRAFT_TTL + 1;
  assert.equal(store.read(), null);
  values.set("test", "broken");
  assert.equal(store.read(), null);
  assert.equal(draftStore(undefined, "none").save(draft), false);
});
test("public IDs are deterministic and do not contain private UID or activity code", async () => {
  const a = await opaquePublicId("S1_fictional-private-uid_entry");
  assert.match(a, /^p_[a-f0-9]{64}$/);
  assert.equal(a.includes("fictional"), false);
  assert.equal(a, await opaquePublicId("S1_fictional-private-uid_entry"));
  assert.notEqual(a, await opaquePublicId("S2_fictional-private-uid_entry"));
});
test("official cache importer requires independent review, checksum and explicit coordinate mapping", () => {
  const raw = Buffer.from(
    JSON.stringify([
      {
        code: "fixture",
        title: "가상 시설",
        address: "가상 주소",
        region: "충남 공주",
        lat: 36,
        lon: 127,
      },
    ]),
  );
  const review = {
    reviewed: true,
    sourceSha256: createHash("sha256").update(raw).digest("hex"),
    sourceUrl: "https://mfis.mpva.go.kr/api/json/allSearch.do",
    crs: "EPSG:4326",
    updatedAt: "2026-10-29",
    license: "TEST ONLY",
    coordinateEvidence: "fixture axes only, not official API verification",
    authenticationEvidence: "fixture",
    corsEvidence: "fixture",
    responseEvidence: "fixture",
    fields: {
      id: "code",
      name: "title",
      address: "address",
      region: "region",
      latitude: "lat",
      longitude: "lon",
    },
    spotChecks: [
      {
        id: "fixture",
        latitude: 36,
        longitude: 127,
        evidenceUrl: "https://mfis.mpva.go.kr/fixture",
      },
    ],
  };
  assert.equal(buildCache(raw, review).facilities.length, 1);
  assert.throws(() => buildCache(raw, { ...review, coordinateEvidence: "" }));
  assert.throws(() =>
    buildCache(raw, {
      ...review,
      fields: { ...review.fields, latitude: "lon", longitude: "lat" },
    }),
  );
  assert.throws(() => buildCache(raw, { ...review, sourceSha256: "wrong" }));
});

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
test("read-only Rules comparison redacts emails; offline merge preserves unrelated app and refuses overwrite", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "veterans-rules-test-"));
  try {
    const current = {
      rules: {
        ".read": false,
        ".write": false,
        memoryTemperature2026: {
          submissions: {
            ".read":
              "auth != null && auth.token.email == 'fictional@example.invalid'",
          },
        },
        anotherApp: { ".read": "auth != null", keep: "unchanged" },
      },
    };
    const input = path.join(dir, "current.json"),
      out = path.join(dir, "merged.json");
    writeFileSync(input, JSON.stringify(current));
    const here = path.dirname(fileURLToPath(import.meta.url)),
      candidate = path.join(here, "database.rules.json");
    const log = execFileSync(
      process.execPath,
      [path.join(here, "compare-rules.mjs"), input, candidate],
      { encoding: "utf8" },
    );
    assert.equal(log.includes("fictional@example.invalid"), false);
    execFileSync(process.execPath, [
      path.join(here, "merge-rules.mjs"),
      input,
      candidate,
      out,
      "existing",
    ]);
    const merged = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(merged.rules.anotherApp, current.rules.anotherApp);
    assert.equal(merged.rules[".write"], false);
    assert.match(
      merged.rules.memoryTemperature2026.works[".read"],
      /fictional@example.invalid/,
    );
    assert.deepEqual(JSON.parse(readFileSync(input, "utf8")), current);
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [path.join(here, "merge-rules.mjs"), input, candidate, out, "existing"],
        { stdio: "pipe" },
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("private Rules failures do not print source text and symlinked checkout outputs are blocked", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "veterans-private-test-"));
  try {
    const here = path.dirname(fileURLToPath(import.meta.url)),
      input = path.join(dir, "invalid.json");
    writeFileSync(
      input,
      '{"rules": "fictional-private@example.invalid" BROKEN}',
    );
    for (const script of ["compare-rules.mjs", "merge-rules.mjs"]) {
      try {
        execFileSync(
          process.execPath,
          [
            path.join(here, script),
            input,
            path.join(here, "database.rules.json"),
            path.join(dir, "out.json"),
          ],
          { encoding: "utf8", stdio: "pipe" },
        );
        assert.fail("invalid JSON accepted");
      } catch (e) {
        assert.equal(
          String(e.stderr).includes("fictional-private@example.invalid"),
          false,
        );
        assert.match(String(e.stderr), /원문 내용은 출력하지 않습니다/);
      }
    }
    const { symlinkSync } = fsForPrivateTest;
    const alias = path.join(dir, "checkout-alias");
    symlinkSync(path.resolve(here, "../.."), alias, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          path.join(here, "merge-rules.mjs"),
          input,
          path.join(here, "database.rules.json"),
          path.join(alias, "private-rules-output.json"),
        ],
        { stdio: "pipe" },
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("server timestamps resist a fast device clock while retries freeze the stored creation time", async () => {
  const { creationForRetry, databaseTimestamp } = await import("../media-policy.js");
  const draft = { title: "synthetic", createdAt: Date.now() + 86400000 };
  assert.deepEqual(creationForRetry(draft, null).createdAt, { ".sv": "timestamp" });
  assert.equal(creationForRetry(draft, { createdAt: 123 }).createdAt, 123);
  assert.equal(draft.createdAt > Date.now(), true);
  assert.deepEqual(databaseTimestamp(), { ".sv": "timestamp" });
  assert.throws(() => creationForRetry(draft, {}));
});
