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
    ["image/jpeg", 10485760],
    ["video/mp4", 104857600],
    ["application/pdf", 20971520],
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
