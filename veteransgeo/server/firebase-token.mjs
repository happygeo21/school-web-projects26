// Firebase RS256 verification, without Admin SDK, custom claims or a service account.
const jwksURL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let cached = null,
  expires = 0;
export async function googleKeys() {
  if (cached && Date.now() < expires) return cached;
  const r = await fetch(jwksURL, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw Error("keys unavailable");
  const json = await r.json();
  if (!Array.isArray(json.keys)) throw Error("invalid keys");
  cached = json.keys;
  const age = Number(
    r.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 300,
  );
  expires = Date.now() + Math.min(age, 3600) * 1000;
  return cached;
}
function decode(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw Error("invalid JWT");
  return Uint8Array.from(
    atob(
      s
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(s.length / 4) * 4, "="),
    ),
    (c) => c.charCodeAt(0),
  );
}
export async function verifyFirebaseToken(
  token,
  {
    projectId = "",
    getKeys = googleKeys,
    now = Math.floor(Date.now() / 1000),
  } = {},
) {
  if (!projectId || typeof token !== "string" || token.length > 16000)
    throw Error("invalid token");
  const parts = token.split(".");
  if (parts.length !== 3) throw Error("invalid token");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0]))),
    p = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    header.crit ||
    header.jku ||
    header.jwk
  )
    throw Error("invalid header");
  const jwk = (await getKeys()).find(
    (k) =>
      k.kid === header.kid &&
      k.kty === "RSA" &&
      (!k.alg || k.alg === "RS256") &&
      (!k.use || k.use === "sig"),
  );
  if (!jwk) throw Error("unknown kid");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    ))
  )
    throw Error("signature");
  if (
    p.aud !== projectId ||
    p.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof p.sub !== "string" ||
    p.sub.length < 1 ||
    p.sub.length > 128 ||
    /[\s\x00-\x1f]/.test(p.sub)
  )
    throw Error("project or subject");
  if (
    ![p.exp, p.iat, p.auth_time].every(Number.isSafeInteger) ||
    p.exp <= now ||
    p.iat > now ||
    p.auth_time > now ||
    p.auth_time < 1 ||
    p.auth_time > p.iat ||
    p.iat >= p.exp ||
    p.exp - p.iat > 7200
  )
    throw Error("time");
  return p;
}
