// Page-memory only. Never expose capabilities in DOM events, records, logs or Web Storage.
import { mediaError } from "./media-policy.js";
let invite = null, grant = null, owner = null, info = null, epoch = 0;
const notify = () => window.dispatchEvent(new Event("memory-upload-access"));
const unavailable = () => mediaError("media/permission", "선생님이 준 업로드 링크로 접속해주세요. 새 링크는 이 화면에서 열 수 있어요. 글과 선택한 파일은 그대로 유지돼요.");
export function acceptInvite(value) {
  ++epoch; grant = null; info = null; owner = null;
  invite = /^i_[a-f0-9]{64}$/.test(value || "") ? value : null;
  notify();
}
export function uploadAccessInfo() { return info ? { ...info } : { available: !!invite }; }
export function clearUploadAccess() { ++epoch; invite = grant = owner = info = null; notify(); }
export async function authorizeUpload(call, { uid, schoolId, token, signal }) {
  if (!uid) throw unavailable();
  if (owner && owner !== uid) { clearUploadAccess(); throw unavailable(); }
  const version = epoch;
  if (!grant) {
    if (!invite) throw unavailable();
    const result = await call("invite-redeem", { inviteToken: invite }, token, signal);
    if (version !== epoch) throw unavailable();
    owner = uid; grant = result.grantToken; invite = null;
    info = { schoolId: result.schoolId, expiresAt: result.expiresAt, maxBytes: result.maxBytes, available: true };
    notify();
  }
  if (schoolId && schoolId !== info.schoolId)
    throw mediaError("media/permission", "링크의 학교와 위에서 선택한 학교가 달라요. 초안은 유지했어요. 학교를 확인하거나 맞는 학교 링크를 받아주세요.");
  // Always contact server: expiry/revocation cannot be checked from a cached grant.
  await call("invite-check", { grantToken: grant, schoolId: info.schoolId }, token, signal);
  if (version !== epoch || owner !== uid) throw unavailable();
  return { ...info, grantToken: grant };
}
