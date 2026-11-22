// Shared by the browser, gateway and isolated tests. No credentials or SDK dependencies.
export const MEDIA_LIMITS = Object.freeze({
  image: 3 * 1024 ** 2,
  video: 15 * 1024 ** 2,
  pdf: 5 * 1024 ** 2,
});
export const MIME_GROUP = Object.freeze({
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "application/pdf": "pdf",
});
export function mediaError(code, message) {
  return Object.assign(new Error(message), { code });
}
// RTDB may queue writes while offline. Keep the same ID, but release the UI on timeout/cancel.
export function waitForAck(operation, signal, timeout = 20000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (fn, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      fn(value);
    };
    const abort = () =>
      finish(
        reject,
        mediaError(
          "media/canceled",
          "취소했어요. 작성 내용은 그대로 두고 같은 작품으로 다시 시도해주세요.",
        ),
      );
    const timer = setTimeout(
      () =>
        finish(
          reject,
          mediaError(
            "media/network",
            "저장 확인이 늦어지고 있어요. 내용은 보관했어요. 같은 작품으로 다시 시도해주세요.",
          ),
        ),
      timeout,
    );
    operation.then(
      (v) => finish(resolve, v),
      (e) => finish(reject, e),
    );
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}
export function validateMedia(file) {
  const group = MIME_GROUP[file?.type];
  if (
    !group ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > MEDIA_LIMITS[group]
  )
    throw mediaError(
      "media/invalid-file",
      "이미지는 3MB, 영상은 15MB, PDF는 5MB까지예요. 큰 영상은 외부 링크로 제출해주세요.",
    );
  return group;
}
export async function checkSignature(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer()),
    s = String.fromCharCode(...b);
  const ok =
    file.type === "image/jpeg"
      ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : file.type === "image/png"
        ? b.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
        : file.type === "image/webp"
          ? s.startsWith("RIFF") && s.slice(8, 12) === "WEBP"
          : file.type === "video/mp4"
            ? s.slice(4, 8) === "ftyp"
            : file.type === "video/webm"
              ? b.slice(0, 4).join(",") === "26,69,223,163"
              : file.type === "application/pdf" && s.startsWith("%PDF-");
  if (!ok)
    throw mediaError(
      "media/invalid-file",
      "파일 내용과 형식이 맞지 않아요. JPG·PNG·WebP·MP4·WebM·PDF 원본을 확인해주세요.",
    );
}
export async function digestBytes(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function quotaDecision(used, size, type, capacity = 1_000_000_000) {
  if (
    ![used, size, capacity].every(Number.isSafeInteger) ||
    used < 0 ||
    size < 0 ||
    capacity < 1
  )
    throw mediaError(
      "media/quota-unknown",
      "저장공간 확인이 필요해요. 글이나 외부 링크로 제출해주세요.",
    );
  if (
    used + size > capacity ||
    (type.startsWith("video/") && used + size >= capacity * 0.9)
  )
    throw mediaError(
      "media/quota-full",
      "무료 저장공간이 부족해요. 파일을 줄이거나 외부 링크로 제출해주세요.",
    );
  return {
    used,
    capacity,
    warning: used + size >= capacity * 0.7,
    videoBlocked: used + size >= capacity * 0.9,
  };
}
export const WORK_STATUS = Object.freeze({
  pending: "승인 대기",
  approved: "승인 완료",
  changes_requested: "수정 요청",
  rejected: "반려",
  private: "비공개",
  archived: "보관",
});
export function publicWork(w, publicId, approvedAt) {
  return {
    schoolId: w.schoolId,
    facilityName: w.facilityName,
    title: w.title,
    type: w.type,
    introduction: w.introduction,
    submissionMode: w.submissionMode,
    approvedAt,
    status: "approved",
    ...(w.submissionMode === "external" ? { externalUrl: w.externalUrl } : {}),
    ...(w.submissionMode === "upload"
      ? { mediaPublicId: publicId, contentType: w.contentType }
      : {}),
    ...(w.sourceNote ? { sourceNote: w.sourceNote } : {}),
  };
}

// Firebase resolves this atomically before Rules validation, independent of a fast device clock.
export const databaseTimestamp = () => ({ ".sv": "timestamp" });
export function creationForRetry(payload, existing) {
  if (existing != null && (!Number.isSafeInteger(existing.createdAt) || existing.createdAt < 1))
    throw Error("기존 생성 시각을 확인하지 못했어요. 새 작품으로 덮어쓰지 않습니다.");
  return { ...payload, createdAt: existing == null ? databaseTimestamp() : existing.createdAt };
}
