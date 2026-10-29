// Server-only REST adapters. Never import this module from a public client bundle.
import { mediaError } from "../media-policy.js";
export function createAdapters({
  supabaseURL,
  serviceKey,
  bucket,
  databaseURL,
  root = "memoryTemperature2026",
  fetcher = fetch,
}) {
  const sb = new URL(supabaseURL),
    dbURL = new URL(databaseURL);
  if (
    sb.protocol !== "https:" ||
    !sb.hostname.endsWith(".supabase.co") ||
    dbURL.protocol !== "https:" ||
    !/(\.firebasedatabase\.app|\.firebaseio\.com)$/.test(dbURL.hostname) ||
    !serviceKey ||
    !/^[a-z0-9-]+$/.test(bucket)
  )
    throw Error("invalid server configuration");
  const credentials = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
  async function rest(path, options = {}) {
    const r = await fetcher(sb.origin + path, {
      ...options,
      headers: { ...credentials, ...options.headers },
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (/quota|daily_limit/i.test(d.message || ""))
        throw mediaError(
          "media/quota-full",
          "무료 사용량 또는 오늘의 제출 한도에 도달했어요. 글·링크로 제출해주세요.",
        );
      if (/upload_busy/.test(d.message || ""))
        throw mediaError(
          "media/retry",
          "같은 파일을 이미 전송 중이에요. 잠시 뒤 다시 확인해주세요.",
        );
      throw mediaError("media/unavailable", "저장소 상태를 확인할 수 없어요.");
    }
    return r;
  }
  const rpc = async (name, data) =>
    (
      await rest("/rest/v1/rpc/" + name, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    ).json();
  async function readDB(parts, token) {
    const url = new URL(
      dbURL.origin +
        "/" +
        [root, ...parts].map(encodeURIComponent).join("/") +
        ".json",
    );
    // Firebase ID tokens use the documented auth parameter; never log this URL or follow redirects.
    if (token) url.searchParams.set("auth", token);
    const r = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok)
      throw mediaError(
        "media/permission",
        "데이터베이스 읽기 권한을 확인해주세요.",
      );
    return r.json();
  }
  const objectPath = (key) =>
    "/storage/v1/object/" +
    bucket +
    "/" +
    key.split("/").map(encodeURIComponent).join("/");
  return {
    db: {
      work: (p, t) => readDB(["works", p.schoolId, p.ownerUid, p.workId], t),
      published: (id) => readDB(["publishedWorks", id]),
    },
    ledger: {
      reserve: (d) => rpc("veterans_reserve_media", { p: d }),
      ready: (id) =>
        rpc("veterans_media_state", { p_id: id, p_state: "ready" }),
      deleted: (id) =>
        rpc("veterans_media_state", { p_id: id, p_state: "deleted" }),
      missing: (id) =>
        rpc("veterans_media_state", { p_id: id, p_state: "missing" }),
      download: (bytes) => rpc("veterans_download_budget", { p_bytes: bytes }),
      usage: () => rpc("veterans_storage_usage", {}),
      find: async (id) =>
        (
          await (
            await rest(
              "/rest/v1/veterans_media?asset_id=eq." +
                encodeURIComponent(id) +
                "&select=*",
            )
          ).json()
        )[0] || null,
      list: async () =>
        (
          await rest(
            "/rest/v1/veterans_media?state=neq.deleted&order=updated_at.asc&limit=50",
          )
        ).json(),
    },
    blobs: {
      put: (key, bytes, type) =>
        rest(objectPath(key), {
          method: "POST",
          headers: {
            "Content-Type": type,
            "x-upsert": "false",
            "Cache-Control": "no-store",
          },
          body: bytes,
        }),
      delete: async (key) => {
        const r = await fetcher(sb.origin + objectPath(key), {
          method: "DELETE",
          headers: credentials,
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok && r.status !== 404)
          throw mediaError("media/unavailable", "파일 정리가 필요해요.");
      },
      read: (key, range) =>
        rest(objectPath(key), { headers: range ? { Range: range } : {} }),
      head: async (key) => {
        const r = await fetcher(sb.origin + objectPath(key), {
          method: "HEAD",
          headers: credentials,
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        });
        if (r.status === 404) return null;
        if (!r.ok)
          throw mediaError("media/unavailable", "파일 상태 확인이 필요해요.");
        return {
          size: Number(r.headers.get("content-length")),
          type: r.headers.get("content-type")?.split(";")[0],
        };
      },
    },
  };
}
