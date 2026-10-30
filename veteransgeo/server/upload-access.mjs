// Server-only capability service. Raw capabilities are returned once, never persisted.
import { digestBytes, mediaError } from "../media-policy.js";
const hash = (s) => digestBytes(new TextEncoder().encode(s));
const secret = (prefix) => prefix + Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
const deny = () => { throw mediaError("media/permission", "업로드 링크가 만료되었거나 학교·학생 연결이 달라요. 선생님께 새 링크를 받아 같은 화면에서 열어주세요. 글과 선택한 파일은 유지돼요."); };
export function createUploadAccess(store) {
  async function credential(value, prefix) {
    if (typeof value !== "string" || !new RegExp("^" + prefix + "[a-f0-9]{64}$").test(value)) deny();
    return hash(value);
  }
  return {
    async issue(body, uid) {
      const token = secret("i_");
      const result = await store("issue", { school: body.schoolId, teacher: uid,
        ttl: body.minutes ?? 30, per_uid: body.perStudent ?? 3,
        total: body.total ?? 60, max_bytes: body.maxBytes ?? 15728640,
        hash: await hash(token) });
      return { ...result, inviteToken: token };
    },
    list: (school, uid) => store("list", { school, teacher: uid }),
    revoke: (id, uid) => store("revoke", { id, teacher: uid }),
    async redeem(value, uid) {
      const token = secret("g_");
      const result = await store("redeem", { hash: await credential(value, "i_"), uid, grant_hash: await hash(token) });
      return { ...result, grantToken: token };
    },
    async authorize(value, uid, school, extra = {}, action = "check") {
      return store(action, { ...extra, grant_hash: await credential(value, "g_"), uid, school });
    },
  };
}
