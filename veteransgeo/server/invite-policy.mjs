// Server-only configuration. Never copy teacher identifiers into a public bundle or response.
import { mediaError } from "../media-policy.js";
const validUid = uid => typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
const invalid = () => { throw Error("Invalid private invite policy configuration"); };
export function createInvitePolicy({ teachers, schools = {}, admins = [] }) {
  if (!Array.isArray(teachers) || !teachers.every(validUid) || new Set(teachers).size !== teachers.length ||
      !schools || typeof schools !== "object" || Array.isArray(schools) ||
      !Array.isArray(admins) || new Set(admins).size !== admins.length ||
      !admins.every(uid => validUid(uid) && teachers.includes(uid))) invalid();
  const assigned = new Map();
  for (const [uid, values] of Object.entries(schools)) {
    if (!validUid(uid) || !teachers.includes(uid) || !Array.isArray(values) || !values.length ||
        !values.every(s => typeof s === "string" && /^S[1-7]$/.test(s)) || new Set(values).size !== values.length) invalid();
    assigned.set(uid, Object.freeze([...values]));
  }
  const approved = new Set(teachers), adminSet = new Set(admins);
  return Object.freeze({
    actor(uid) {
      if (!approved.has(uid) || (!assigned.has(uid) && !adminSet.has(uid)))
        throw mediaError("media/permission", "담당 학교의 본인 발급 링크만 관리할 수 있어요. 선생님 권한 설정을 확인해주세요.");
      return { uid, kind: "teacher", schools: [...(assigned.get(uid) || [])], admin: adminSet.has(uid) };
    },
  });
}
