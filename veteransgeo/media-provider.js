import { MEDIA_CONFIG } from "./media-config.js";
import {
  validateMedia,
  checkSignature,
  digestBytes,
  mediaError,
} from "./media-policy.js";
export async function prepareFile(file) {
  if (!file)
    throw mediaError("media/invalid-file", "먼저 파일을 선택해주세요.");
  // Input is bounded before decoding to avoid oversized image allocations.
  if (file.size > 20 * 1024 ** 2)
    throw mediaError(
      "media/invalid-file",
      "원본이 너무 커요. 20MB 이하 이미지나 외부 링크를 사용해주세요.",
    );
  await checkSignature(file);
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 40_000_000)
        throw mediaError("media/invalid-file", "이미지 해상도를 줄여주세요.");
      const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Re-encoding removes the original EXIF/GPS metadata. It does not remove visible faces/text.
      file = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(
                  mediaError("media/invalid-file", "이미지를 읽지 못했어요."),
                ),
          "image/jpeg",
          0.82,
        ),
      );
    } finally {
      bitmap.close();
    }
  }
  validateMedia(file);
  await checkSignature(file);
  return { file, sha256: await digestBytes(await file.arrayBuffer()) };
}
export function createMediaProvider(
  config = MEDIA_CONFIG,
  { xhrFactory = () => new XMLHttpRequest(), fetcher = fetch } = {},
) {
  const enabled =
    config.enabled === true &&
    /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1):[0-9]+\/)/.test(
      config.endpoint || "",
    );
  const endpoint = (config.endpoint || "").replace(/\/$/, "");
  const requireReady = () => {
    if (!enabled)
      throw mediaError(
        "media/not-configured",
        "파일 저장소는 아직 연결 전이에요. 글·외부 링크로 제출할 수 있어요.",
      );
  };
  async function call(action, body, token, signal) {
    requireReady();
    const r = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...body }),
      signal,
      cache: "no-store",
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw mediaError(
        d.code || "media/network",
        d.message || "저장소 연결을 확인하고 다시 시도해주세요.",
      );
    }
    return r.headers.get("Content-Type")?.includes("application/json")
      ? r.json()
      : r.blob();
  }
  return {
    enabled,
    upload({
      file,
      schoolId,
      workId,
      activityCode,
      token,
      signal,
      onProgress = () => {},
    }) {
      requireReady();
      return new Promise((resolve, reject) => {
        const x = xhrFactory();
        const abort = () => {
          x.abort();
          done(
            reject,
            mediaError(
              "media/canceled",
              "업로드를 취소했어요. 글과 선택한 파일은 유지했어요.",
            ),
          );
        };
        let settled = false;
        const done = (fn, value) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", abort);
          fn(value);
        };
        x.open("POST", endpoint + "?action=upload");
        x.timeout = 90000;
        x.ontimeout = () =>
          done(
            reject,
            mediaError(
              "media/network",
              "업로드 확인이 늦어져요. 같은 작품으로 재시도하거나 외부 링크를 사용해주세요.",
            ),
          );
        for (const [k, v] of Object.entries({
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
          "X-School-Id": schoolId,
          "X-Work-Id": workId,
          "X-Activity-Code": encodeURIComponent(activityCode),
        }))
          x.setRequestHeader(k, v);
        x.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.round((e.loaded / e.total) * 100));
        };
        x.onload = () => {
          let d = {};
          try {
            d = JSON.parse(x.responseText);
          } catch {}
          if (!d || typeof d !== "object") d = {};
          x.status >= 200 && x.status < 300 && d.state === "ready"
            ? done(resolve, d)
            : done(
                reject,
                mediaError(
                  d.code || "media/network",
                  d.message ||
                    "업로드에 실패했어요. 같은 작품으로 다시 시도해주세요.",
                ),
              );
        };
        x.onerror = () =>
          done(
            reject,
            mediaError(
              "media/network",
              "연결이 끊겼어요. 선택한 파일과 글은 그대로 두고 재시도해주세요.",
            ),
          );
        x.onabort = () =>
          done(
            reject,
            mediaError(
              "media/canceled",
              "업로드를 취소했어요. 글과 선택한 파일은 유지했어요.",
            ),
          );
        if (signal?.aborted) {
          done(reject, mediaError("media/canceled", "업로드를 취소했어요."));
          return;
        }
        signal?.addEventListener("abort", abort, { once: true });
        x.send(file);
      });
    },
    inspect: (body, token) => call("inspect", body, token),
    preview: (body, token) => call("preview", body, token),
    reconcile: (token) => call("reconcile", {}, token),
    usage: (token) => call("usage", {}, token),
    publicUrl(id) {
      requireReady();
      if (!/^p_[a-f0-9]{64}$/.test(id))
        throw mediaError("media/invalid-id", "작품 주소를 확인해주세요.");
      return endpoint + "?publicId=" + id;
    },
  };
}
