// Shared test-only target checks. Contains no credentials and performs no requests.
const production = "school-project-26-1edf4";
function stop() {
  throw Error(
    "테스트 대상 확인 실패: 운영·누락·불일치 설정으로 요청하지 않습니다.",
  );
}
function cleanURL(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    stop();
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    stop();
  return u;
}
export function rehearsalTargets({ projectId, databaseURL, supabaseURL }) {
  if (
    typeof projectId !== "string" ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
    projectId === production
  )
    stop();
  const db = cleanURL(databaseURL),
    sb = cleanURL(supabaseURL);
  if (
    db.hostname.includes(production) ||
    !(
      (db.hostname.startsWith(projectId + "-default-rtdb.") &&
        /\.(firebasedatabase\.app|firebaseio\.com)$/.test(db.hostname)) ||
      db.hostname === projectId + ".firebaseio.com"
    )
  )
    stop();
  if (!/^[a-z0-9]{20}\.supabase\.co$/.test(sb.hostname)) stop();
  return Object.freeze({
    kind: "veteransgeo-rehearsal",
    testOnly: true,
    apiVersion: 1,
    firebaseProjectId: projectId,
    databaseHost: db.hostname,
    supabaseHost: sb.hostname,
    storageBucket: "veterans-private",
  });
}
export function assertReadiness(expected, actual) {
  if (!actual || Object.entries(expected).some(([k, v]) => actual[k] !== v))
    stop();
  return true;
}
export function assertAuthProject(expected, projectNumber, actual) {
  if (
    !/^\d+$/.test(projectNumber || "") ||
    !actual ||
    ![expected.firebaseProjectId, projectNumber].includes(
      String(actual.projectId),
    ) ||
    !Array.isArray(actual.authorizedDomains) ||
    !actual.authorizedDomains.includes(
      expected.firebaseProjectId + ".firebaseapp.com",
    ) ||
    actual.authorizedDomains.some((d) => d.includes(production))
  )
    stop();
  return true;
}
