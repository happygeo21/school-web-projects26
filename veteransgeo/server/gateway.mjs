import {
  validateMedia,
  checkSignature,
  digestBytes,
  mediaError,
} from "../media-policy.js";
/** @returns {never} */
const fail = (code, message) => {
  throw mediaError(code, message);
};
const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const isSchool = (s) => /^S[1-7]$/.test(s || ""),
  isId = (s) => /^[A-Za-z0-9_-]{1,128}$/.test(s || ""),
  isAsset = (s) => /^p_[a-f0-9]{64}$/.test(s || "");
export async function boundedBody(request, max) {
  const reader = request.body?.getReader();
  if (!reader) fail("media/invalid-file", "파일이 비어 있어요.");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        fail("media/invalid-file", "파일 용량 제한을 넘었어요.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function createGateway({
  verify,
  db,
  ledger,
  blobs,
  teachers,
  schoolActivityHashes,
  schoolUploadHashes,
  allowLegacyActivityCodeUpload = false,
  origins,
  deployment = /** @type {Record<string, unknown> | null} */ (null),
  clock = () => Date.now(),
}) {
  let inFlight = 0;
  const teacher = (p) =>
    teachers.includes(p.sub) && p.firebase?.sign_in_provider !== "anonymous";
  async function work(body, p, token) {
    if (!isSchool(body.schoolId) || !isId(body.workId) || !isId(body.ownerUid))
      fail("media/invalid-id", "작품 정보를 확인해주세요.");
    if (body.ownerUid !== p.sub && !teacher(p))
      fail("media/permission", "이 작품의 원본은 볼 수 없어요.");
    const w = await db.work(body, token);
    if (!w || w.schoolId !== body.schoolId)
      fail("media/permission", "작품 정보 또는 저장 권한을 확인해주세요.");
    return w;
  }
  return async (request) => {
    let acquired = false;
    const origin = request.headers.get("Origin"),
      cors =
        origin && origins.includes(origin)
          ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
          : {};
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...noStore, ...cors, "Content-Type": "application/json" },
      });
    try {
      if (origin && !origins.includes(origin))
        fail("media/permission", "허용되지 않은 접속 주소예요.");
      if (request.method === "OPTIONS")
        return new Response(null, {
          status: 204,
          headers: {
            ...noStore,
            ...cors,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Authorization, Content-Type, X-School-Id, X-Work-Id, X-Activity-Code, X-Upload-Code, Range",
            "Access-Control-Max-Age": "300",
          },
        });
      const url = new URL(request.url),
        publicId = url.searchParams.get("publicId");
      if (
        request.method === "GET" &&
        url.searchParams.get("action") === "readiness"
      ) {
        if (!deployment)
          fail("media/unavailable", "테스트 대상 설정을 확인하지 못했습니다.");
        // Only non-secret, allowlisted target identifiers. No Auth/DB/Storage calls.
        return json(
          Object.fromEntries(
            [
              "kind",
              "testOnly",
              "apiVersion",
              "firebaseProjectId",
              "databaseHost",
              "supabaseHost",
              "storageBucket",
            ].map((k) => [k, deployment[k]]),
          ),
        );
      }
      if (request.method === "GET" && publicId) {
        if (!isAsset(publicId))
          fail("media/permission", "작품을 열 수 없어요.");
        // Never return a signed object URL: each new image/video range request checks RTDB publication.
        const published = await db.published(publicId),
          row = await ledger.find(publicId);
        if (
          !published ||
          published.status !== "approved" ||
          published.mediaPublicId !== publicId ||
          !row ||
          row.state !== "ready" ||
          published.schoolId !== row.school_id
        )
          fail("media/permission", "비공개 작품이거나 아직 준비 중이에요.");
        await ledger.download(row.size);
        const response = await blobs.read(
          row.object_key,
          request.headers.get("Range"),
        );
        const headers = new Headers({
          ...noStore,
          ...cors,
          "Content-Type": row.content_type,
          "Content-Disposition":
            row.content_type === "application/pdf"
              ? 'inline; filename="work.pdf"'
              : "inline",
          "Accept-Ranges": "bytes",
        });
        for (const key of ["Content-Range", "Content-Length"])
          if (response.headers.has(key))
            headers.set(key, response.headers.get(key));
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      if (request.method !== "POST")
        return json(
          {
            code: "media/invalid-request",
            message: "요청 방식을 확인해주세요.",
          },
          405,
        );
      const token = request.headers
        .get("Authorization")
        ?.match(/^Bearer (.+)$/)?.[1];
      let p;
      try {
        p = await verify(token);
      } catch {
        fail("auth/invalid-token", "학생 또는 교사 연결을 다시 확인해주세요.");
      }
      if (url.searchParams.get("action") === "upload") {
        if (inFlight >= 2)
          fail(
            "media/retry",
            "업로드가 몰리고 있어요. 잠시 뒤 같은 작품으로 재시도해주세요.",
          );
        inFlight++;
        acquired = true;
        if (p.firebase?.sign_in_provider !== "anonymous")
          fail("media/permission", "학생 연결로 업로드해주세요.");
        const body = {
          schoolId: request.headers.get("X-School-Id"),
          workId: request.headers.get("X-Work-Id"),
          ownerUid: p.sub,
        };
        const independentUploadAuth = !!schoolUploadHashes && (!allowLegacyActivityCodeUpload || request.headers.has("X-Upload-Code"));
        let activity;
        try {
          activity = decodeURIComponent(
            request.headers.get(independentUploadAuth ? "X-Upload-Code" : "X-Activity-Code") || "",
          );
        } catch {
          fail("media/permission", "파일 업로드 인증코드를 확인해주세요.");
        }
        const expected = (independentUploadAuth ? schoolUploadHashes : schoolActivityHashes)?.[body.schoolId];
        if (
          !activity ||
          activity.length > (independentUploadAuth ? 128 : 20) ||
          !expected ||
          expected !== (await digestBytes(new TextEncoder().encode(activity)))
        )
          fail("media/permission", "학교와 파일 업로드 인증코드를 선생님께 확인해주세요.");
        const w = await work(body, p, token);
        if (
          w.status !== "pending" ||
          w.submissionMode !== "upload" ||
          w.mediaProvider !== "gateway" ||
          (!independentUploadAuth && w.activityCode !== activity) ||
          !isAsset(w.mediaAssetId) ||
          !/^[a-f0-9]{64}$/.test(w.sha256 || "")
        )
          fail(
            "media/permission",
            "승인 대기인 내 파일 작품만 올릴 수 있어요.",
          );
        const calculated =
          "p_" +
          (await digestBytes(
            new TextEncoder().encode(
              `${body.schoolId}_${p.sub}_${body.workId}`,
            ),
          ));
        if (w.mediaAssetId !== calculated)
          fail("media/permission", "작품 경로가 맞지 않아요.");
        const type = request.headers.get("Content-Type");
        validateMedia({ type, size: w.size });
        if (type !== w.contentType)
          fail(
            "media/invalid-file",
            "최초 제출과 같은 형식의 파일을 선택해주세요.",
          );
        const bytes = await boundedBody(request, w.size);
        if (bytes.length !== w.size || (await digestBytes(bytes)) !== w.sha256)
          fail("media/invalid-file", "최초 제출과 같은 파일을 선택해주세요.");
        await checkSignature(new Blob([bytes], { type }));
        const reservation = await ledger.reserve({
          asset_id: calculated,
          school_id: body.schoolId,
          owner_uid: p.sub,
          work_id: body.workId,
          size: bytes.length,
          content_type: type,
          sha256: w.sha256,
        });
        if (reservation.existing)
          return json({
            state: "ready",
            duplicate: true,
            warning: reservation.warning,
          });
        try {
          await blobs.put(reservation.object_key, bytes, type);
          await ledger.ready(calculated);
        } catch {
          // Keep bytes reserved until DELETE is confirmed. Never hide an uncertain orphan.
          try {
            await blobs.delete(reservation.object_key);
            await ledger.deleted(calculated);
          } catch {
            /* reconciliation keeps the reservation */
          }
          fail(
            "media/network",
            "파일을 저장하지 못했어요. 같은 작품으로 재시도해주세요.",
          );
        }
        return json({ state: "ready", warning: reservation.warning });
      }
      let body;
      try {
        body = JSON.parse(
          new TextDecoder().decode(await boundedBody(request, 4096)),
        );
      } catch {
        fail("media/invalid-request", "요청 정보를 확인해주세요.");
      }
      if (body.action === "usage") {
        if (!teacher(p))
          fail("media/permission", "승인된 교사만 사용량을 확인할 수 있어요.");
        return json(await ledger.usage());
      }
      if (body.action === "reconcile") {
        if (!teacher(p))
          fail("media/permission", "승인된 교사만 정리할 수 있어요.");
        let checked = 0,
          deleted = 0,
          repaired = 0;
        for (const row of await ledger.list()) {
          checked++;
          const w = await db.work(
            {
              schoolId: row.school_id,
              ownerUid: row.owner_uid,
              workId: row.work_id,
            },
            token,
          );
          // Fail closed when the DB is unavailable: db.work throws instead of returning "missing".
          const age = clock() - Date.parse(row.updated_at),
            expired =
              (!w && age > 86400000) ||
              (w &&
                ["archived", "rejected"].includes(w.status) &&
                clock() - (w.reviewedAt || clock()) > 30 * 86400000);
          const published = await db.published(row.asset_id);
          if (expired && !published) {
            await blobs.delete(row.object_key);
            await ledger.deleted(row.asset_id);
            deleted++;
            continue;
          }
          if (row.state === "uploading" && age > 10 * 60000) {
            const exists = await blobs.head(row.object_key);
            if (
              exists &&
              exists.size === row.size &&
              exists.type === row.content_type &&
              w?.sha256 === row.sha256
            ) {
              await ledger.ready(row.asset_id);
              repaired++;
            } else if (!exists) {
              await ledger.deleted(row.asset_id);
              deleted++;
            }
          } else if (
            ["ready", "missing"].includes(row.state) &&
            !(await blobs.head(row.object_key))
          ) {
            await ledger.deleted(row.asset_id);
            repaired++;
          }
        }
        return json({ checked, deleted, repaired });
      }
      const w = await work(body, p, token),
        row = w.mediaAssetId && (await ledger.find(w.mediaAssetId));
      if (
        !row ||
        row.owner_uid !== body.ownerUid ||
        row.work_id !== body.workId ||
        row.school_id !== body.schoolId
      )
        fail(
          "media/not-ready",
          "파일을 아직 받지 못했어요. 업로드를 다시 시도해주세요.",
        );
      if (body.action === "inspect") return json({ state: row.state });
      if (body.action === "preview" && row.state === "ready") {
        await ledger.download(row.size);
        const response = await blobs.read(row.object_key);
        return new Response(response.body, {
          headers: {
            ...noStore,
            ...cors,
            "Content-Type": row.content_type,
            "Content-Disposition": "inline",
          },
        });
      }
      fail("media/not-ready", "파일이 아직 준비 중이에요.");
    } catch (e) {
      const code = /^(media|auth)\/[a-z-]+$/.test(e?.code || "")
          ? e.code
          : "media/unavailable",
        message =
          code === "media/unavailable"
            ? "저장소 상태를 확인할 수 없어요. 글·외부 링크 제출을 사용해주세요."
            : e.message;
      return json(
        { code, message },
        code.startsWith("auth/")
          ? 401
          : code.includes("permission")
            ? 403
            : code.includes("quota")
              ? 429
              : code.includes("invalid")
                ? 400
                : 503,
      );
    } finally {
      if (acquired) inFlight--;
    }
  };
}
