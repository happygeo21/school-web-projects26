// Server-only key selection. Never return key values in readiness or diagnostic output.
function invalid() {
  throw Error("Supabase server key configuration requires review");
}
export function serverKeyHeaders(key) {
  if (typeof key !== "string" || !key || /\s/.test(key)) invalid();
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key)) return { apikey: key };
  // Legacy service_role is a JWT. Checking its shape/role does not validate it;
  // Supabase performs that verification when the server sends the request.
  try {
    const parts = key.split(".");
    if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p)))
      invalid();
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.role !== "service_role") invalid();
    return { apikey: key, Authorization: `Bearer ${key}` };
  } catch {
    invalid();
  }
}
export function serverKeyFromEnvironment(read) {
  // Current hosted runtimes inject a JSON dictionary. Do not attempt to create
  // a custom SUPABASE_* secret: that prefix is reserved by the platform.
  const keys = read("SUPABASE_SECRET_KEYS");
  let key;
  if (keys) {
    try {
      const values = JSON.parse(keys);
      key = values && !Array.isArray(values) ? values.default : null;
    } catch {
      invalid();
    }
    if (!/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key || "")) invalid();
  } else key = read("SUPABASE_SERVICE_ROLE_KEY");
  serverKeyHeaders(key);
  return key;
}
