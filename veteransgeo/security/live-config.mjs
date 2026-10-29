import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rehearsalTargets } from "../server/rehearsal-target.mjs";
export const checkout = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export async function privatePath(file, { existing = true } = {}) {
  const p = path.resolve(file),
    resolved = existing
      ? await realpath(p)
      : path.join(await realpath(path.dirname(p)), path.basename(p));
  if (resolved === checkout || resolved.startsWith(checkout + path.sep))
    throw Error("설정·결과·test-web은 저장소 밖 비공개 경로만 사용하세요.");
  return resolved;
}
export function validateLiveConfig(c) {
  if (
    c?.purpose !== "veteransgeo-test-only" ||
    c.firebasePlan !== "Spark" ||
    c.supabasePlan !== "Free" ||
    c.syntheticDataOnly !== true
  )
    throw Error(
      "별도 무료 테스트 프로젝트·가상 자료 전용임을 확인해야 합니다.",
    );
  const f = c.firebase,
    t = rehearsalTargets({
      projectId: f?.projectId,
      databaseURL: f?.databaseURL,
      supabaseURL: c.supabaseURL,
    });
  if (
    !/^\d+$/.test(c.projectNumber || "") ||
    f.appId?.split(":")[1] !== c.projectNumber ||
    f.authDomain !== f.projectId + ".firebaseapp.com" ||
    typeof f.apiKey !== "string" ||
    f.apiKey.length < 20 ||
    f.apiKey.length > 128
  )
    throw Error("Console의 테스트 Web 설정·프로젝트 번호를 확인하세요.");
  const origin = new URL(c.webOrigin);
  if (
    origin.origin !== c.webOrigin ||
    Number(origin.port) < 1 ||
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(c.webOrigin)
  )
    throw Error("test-web은 명시한 localhost 포트에서만 실행하세요.");
  if (c.mediaEndpoint !== "https://" + t.supabaseHost + "/functions/v1/media")
    throw Error("테스트 Supabase media 함수 URL이 일치하지 않습니다.");
  if (
    !c.teachers?.approved?.email ||
    !c.teachers?.approved?.password ||
    !c.teachers?.approved?.uid ||
    !c.teachers?.unapproved?.email ||
    !c.teachers?.unapproved?.password ||
    !c.teachers?.unapproved?.uid ||
    c.teachers.approved.uid === c.teachers.unapproved.uid
  )
    throw Error("승인/미승인 가상 교사 두 계정을 비공개 설정에 지정하세요.");
  for (const s of Array.from({ length: 7 }, (_, i) => "S" + (i + 1)))
    if (
      typeof c.activityCodes?.[s] !== "string" ||
      !c.activityCodes[s] ||
      c.activityCodes[s].length > 20
    )
      throw Error("S1~S7 테스트 활동코드를 비공개 설정에 지정하세요.");
  // No admin/service key belongs in this client test configuration.
  if (
    Object.keys(c).some((k) =>
      /service.?role|secret.?key|private.?key|access.?token/i.test(k),
    )
  )
    throw Error("서버 비밀키는 이 클라이언트 설정에 넣지 마세요.");
  return { config: c, targets: t };
}
export async function readLiveConfig(file) {
  if (!file)
    throw Error(
      "비공개 테스트 설정 파일을 --config로 지정하세요. 운영 설정으로 대체하지 않습니다.",
    );
  const p = await privatePath(file),
    s = await stat(p);
  if ((s.mode & 0o077) !== 0)
    throw Error("테스트 설정 파일 권한을 0600으로 제한하세요.");
  let data;
  try {
    data = JSON.parse(await readFile(p, "utf8"));
  } catch {
    throw Error(
      "비공개 설정 JSON을 읽지 못했습니다. 원문은 출력하지 않습니다.",
    );
  }
  return validateLiveConfig(data);
}
