// Tab-scoped recovery only: no tokens, email, files, or localStorage. Expire after 2h.
export const DRAFT_TTL = 2 * 60 * 60 * 1000;
export const DRAFT_FIELDS = [
  "school",
  "activityCode",
  "category",
  "placeOrigin",
  "placeName",
  "address",
  "placeDescription",
  "officialStatus",
  "awarenessScore",
  "lat",
  "lng",
  "locationConfirmed",
  "importance",
  "visibility",
  "scoreReason",
  "sourceType",
  "sourceNote",
  "rememberSentence",
  "message",
  "keywords",
];
export function draftStore(storage, key, now = Date.now) {
  return {
    read() {
      try {
        const value = JSON.parse(storage.getItem(key) || "null");
        if (
          !value ||
          value.version !== 1 ||
          !Number.isFinite(value.savedAt) ||
          now() - value.savedAt > DRAFT_TTL ||
          value.savedAt > now() ||
          JSON.stringify(value).length > 40000
        ) {
          storage.removeItem(key);
          return null;
        }
        return value;
      } catch {
        return null;
      }
    },
    save(value) {
      try {
        const text = JSON.stringify({ ...value, version: 1, savedAt: now() });
        if (text.length > 40000) return false;
        storage.setItem(key, text);
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {}
    },
  };
}
export function captureFields(form = document) {
  return Object.fromEntries(
    DRAFT_FIELDS.map((id) => [
      id,
      String(form.getElementById(id)?.value || "").slice(0, 2000),
    ]),
  );
}
export function restoreFields(fields, form = document) {
  for (const id of DRAFT_FIELDS)
    if (typeof fields?.[id] === "string" && form.getElementById(id))
      form.getElementById(id).value = fields[id];
}
export async function opaquePublicId(privateKey) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(privateKey),
  );
  return (
    "p_" +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}

export function safeTabStorage() {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}
