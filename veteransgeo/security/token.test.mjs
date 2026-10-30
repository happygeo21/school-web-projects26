import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyFirebaseToken } from "../server/firebase-token.mjs";
test("Firebase JWT real RSA signature: rejects wrong project/kid/alg/signature, expired/future times and invalid subject", async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const key = {
      ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
      kid: "test-key",
      alg: "RS256",
      use: "sig",
    },
    now = 2000000000;
  const options = {
    projectId: "demo-veteransgeo",
    getKeys: async () => [key],
    now,
  };
  const b64 = (b) => Buffer.from(b).toString("base64url");
  async function sign(patch = {}, head = {}) {
    const h = b64(JSON.stringify({ alg: "RS256", kid: key.kid, ...head })),
      p = b64(
        JSON.stringify({
          sub: "test-student",
          aud: options.projectId,
          iss: "https://securetoken.google.com/" + options.projectId,
          iat: now - 10,
          auth_time: now - 100,
          exp: now + 3500,
          ...patch,
        }),
      ),
      s = b64(
        await crypto.subtle.sign(
          "RSASSA-PKCS1-v1_5",
          pair.privateKey,
          new TextEncoder().encode(h + "." + p),
        ),
      );
    return h + "." + p + "." + s;
  }
  assert.equal(
    (await verifyFirebaseToken(await sign(), options)).sub,
    "test-student",
  );
  for (const patch of [
    { aud: "other" },
    { iss: "https://evil.invalid" },
    { exp: now },
    { iat: now + 1 },
    { auth_time: now + 1 },
    { auth_time: 0 },
    { sub: "" },
    { sub: "x".repeat(129) },
    { iat: "1" },
  ])
    await assert.rejects(verifyFirebaseToken(await sign(patch), options));
  for (const head of [
    { kid: "missing" },
    { alg: "none" },
    { alg: "HS256" },
    { jku: "https://evil.invalid" },
    { crit: ["x"] },
  ])
    await assert.rejects(verifyFirebaseToken(await sign({}, head), options));
  const valid = await sign();
  await assert.rejects(
    verifyFirebaseToken(valid.slice(0, -15) + "AAAAAAAAAAAAAAA", options),
  );
});
