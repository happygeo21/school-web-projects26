import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serverKeyFromEnvironment,
  serverKeyHeaders,
} from "../server/supabase-key.mjs";
import { createAdapters } from "../server/supabase-adapter.mjs";
const secret = "sb_secret_" + "synthetic_server_only_".repeat(2);
const jwt = (role) =>
  [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "syntheticSignature",
  ].join(".");
test("current and legacy server keys: explicit default, role check, fail closed without leaking values", () => {
  const read = (values) => (name) => values[name];
  assert.equal(
    serverKeyFromEnvironment(
      read({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: secret }) }),
    ),
    secret,
  );
  assert.equal(
    serverKeyFromEnvironment(
      read({ SUPABASE_SERVICE_ROLE_KEY: jwt("service_role") }),
    ),
    jwt("service_role"),
  );
  for (const values of [
    {},
    { SUPABASE_SECRET_KEYS: "malformed-private-value" },
    { SUPABASE_SECRET_KEYS: JSON.stringify({ other: secret }) },
    {
      SUPABASE_SECRET_KEYS: "[]",
      SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
    },
    { SUPABASE_SERVICE_ROLE_KEY: jwt("anon") },
  ])
    assert.throws(() => serverKeyFromEnvironment(read(values)), {
      message: "Supabase server key configuration requires review",
    });
  assert.deepEqual(serverKeyHeaders(secret), { apikey: secret });
  assert.equal(
    serverKeyHeaders(jwt("service_role")).Authorization,
    "Bearer " + jwt("service_role"),
  );
  assert.throws(() => serverKeyHeaders("sb_publishable_" + "x".repeat(30)));
});
test("REST, Storage read/head/delete use server headers; Firebase requests never receive Supabase keys", async () => {
  for (const key of [secret, jwt("service_role")]) {
    const calls = [];
    const a = createAdapters({
      supabaseURL: "https://abcdefghijklmnopqrst.supabase.co",
      databaseURL:
        "https://fixture-test-default-rtdb.asia-southeast1.firebasedatabase.app",
      serviceKey: key,
      bucket: "veterans-private",
      fetcher: async (url, options) => {
        calls.push({ url: String(url), headers: new Headers(options.headers) });
        return new Response("{}", {
          headers: {
            "content-type": "application/json",
            "content-length": "2",
          },
        });
      },
    });
    await a.ledger.usage();
    await a.blobs.read("synthetic", "bytes=0-1");
    await a.blobs.head("synthetic");
    await a.blobs.delete("synthetic");
    await a.db.published("synthetic");
    for (const call of calls.slice(0, 4)) {
      assert.equal(call.headers.get("apikey"), key);
      assert.equal(
        call.headers.get("Authorization"),
        key.startsWith("sb_secret_") ? null : "Bearer " + key,
      );
    }
    assert.equal(calls.at(-1).headers.get("apikey"), null);
    assert.equal(calls.at(-1).headers.get("Authorization"), null);
  }
});
