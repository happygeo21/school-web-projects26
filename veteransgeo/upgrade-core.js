import { PROJECT, MEDIA_LINK_HOSTS } from "./project-config.js";
export const MEDIA_TYPES = ['글','사진','포스터','카드뉴스','영상','PDF','링크','홍보 기획안'];
export {MEDIA_LIMITS as LIMITS,validateMedia as checkFile} from './media-policy.js';
export function coordinates(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 33 &&
    lat <= 39.5 &&
    lng >= 124 &&
    lng <= 132
  );
}
function validateRecordFields(d, legacyOriginal) {
  if (!PROJECT.schools.some((s) => s.id === d.schoolId))
    throw Error("학교를 다시 선택해주세요.");
  const fields = {
    activityCode: [1, 20],
    placeName: [1, 100],
    placeDescription: [10, 350],
    address: [0, 160],
    scoreReason: [10, 300],
    sourceNote: [1, 300],
    rememberSentence: [10, 250],
    keywords: [1, 200],
    message: [0, 300],
  };
  for (const [k, [min, max]] of Object.entries(fields)) {
    const preservedEmptyNote = k === "sourceNote" && d[k] === "" && legacyOriginal?.sourceNote === "";
    if (!preservedEmptyNote && (typeof d[k] !== "string" || d[k].trim().length < min || d[k].length > max))
      throw Error("설명·근거·기억 문장과 입력 길이를 확인해주세요.");
  }
  if (!coordinates(d.latitude, d.longitude))
    throw Error("대한민국 안의 정확한 위치를 확인해주세요.");
  for (const [key, max] of [
    ["awarenessScore", 4],
    ["importance", 5],
    ["visibility", 5],
  ])
    if (!Number.isInteger(d[key]) || d[key] < 1 || d[key] > max)
      throw Error("인지도와 평가 점수를 다시 확인해주세요.");
  if (
    !PROJECT.categories.includes(d.category) ||
    !PROJECT.sourceTypes.includes(d.sourceType) ||
    !PROJECT.officialStatuses.some((s) => s.value === d.officialStatus) ||
    (!["official_map", "student_suggested"].includes(d.placeOrigin) && (!legacyOriginal || d.placeOrigin !== legacyOriginal.placeOrigin))
  )
    throw Error("분류·출처·장소 선택 방식을 확인해주세요.");
  return d;
}
export function validateRecord(d) { return validateRecordFields(d, null); }
// Historical empty notes/old origin labels may remain unchanged during a teacher edit.
// The saved original is checked again by the teacher UI and RTDB Rules. New submissions stay strict.
export function validateRecordEdit(d, original) {
  const legacy = original && !original.awarenessOriginal && original.schemaVersion !== 2 ? original : null;
  return validateRecordFields(d, legacy);
}
export function errorMessage(e) {
  const code = String(e?.code || "");
  if (/permission|unauthorized|unauthenticated/i.test(code))
    return "로그인과 저장 권한은 달라요. 작성한 내용은 그대로 있어요. 선생님께 저장 권한 확인을 부탁하고 다시 시도하세요.";
  if (/auth\//.test(code))
    return "학생 연결에 실패했어요. 인터넷 연결을 확인하고 학생 연결을 다시 눌러주세요.";
  if (/network|retry|unavailable|timeout|canceled|disconnected/i.test(code))
    return "연결이 불안정해요. 작성한 내용은 그대로 두고 잠시 뒤 다시 시도하세요.";
  return "저장하지 못했어요. 입력 내용을 확인하고 다시 시도해주세요.";
}
// Only a fixed stage, normalized error code and timestamp. Never payload, UID, email, URL or token.
export function diagnostic(stage, e) {
  console.info(
    "veteransgeo",
    JSON.stringify({
      stage: ["auth", "submit", "media", "review"].includes(stage)
        ? stage
        : "unknown",
      code: /permission|unauthorized/i.test(e?.code || "")
        ? "permission"
        : /auth\//.test(e?.code || "")
          ? "auth"
          : /network|timeout|unavailable|disconnected/i.test(e?.code || "")
            ? "network"
            : /storage\//.test(e?.code || "")
              ? "storage"
              : "unknown",
      time: Date.now(),
    }),
  );
}
export function publication(r) {
  return Object.fromEntries(
    [
      "schoolId",
      "category",
      "placeOrigin",
      "placeName",
      "placeDescription",
      "address",
      "latitude",
      "longitude",
      "officialStatus",
      "awarenessScore",
      "importance",
      "visibility",
      "scoreReason",
      "sourceType",
      "sourceNote",
      "rememberSentence",
      "message",
      "keywords",
    ].map((k) => [k, r[k] ?? ""]),
  );
}
export const EDITABLE = [
  "placeName",
  "placeDescription",
  "category",
  "address",
  "latitude",
  "longitude",
  "sourceType",
  "sourceNote",
  "scoreReason",
  "importance",
  "visibility",
  "rememberSentence",
  "message",
  "keywords",
  "officialStatus",
];

export function externalLink(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !MEDIA_LINK_HOSTS.includes(url.hostname)
  )
    throw Error(
      "허용된 학교 자료 링크(Google Drive·문서·YouTube)의 HTTPS 주소를 입력해주세요.",
    );
  return url.href;
}
