// Login controls retain no credentials and never retry Firebase requests automatically.
export function teacherAuthFailure(error, { stage = 'authentication', testMode = false } = {}) {
  const raw = String(error?.code || 'unknown');
  const code = /^[A-Za-z0-9_/-]{1,80}$/.test(raw) ? raw : 'unknown';
  let message;
  if (stage === 'database' && /permission[-_]denied/i.test(code)) message = 'Firebase 인증은 성공했지만 DB 읽기 권한이 거부됐어요. 승인 교사 등록과 현재 프로젝트 권한을 관리자에게 확인해주세요. 비밀번호 오류가 아닙니다.';
  else if (code === 'auth/too-many-requests') message = 'Firebase에서 로그인을 일시 제한했어요. 반복해서 누르지 말고 기다린 뒤 관리자에게 제한 상태를 확인해주세요. 이 화면은 15분 동안 새 로그인 요청을 막습니다. 이후 새로고침해 확인할 수 있지만 Firebase 제한 해제 시점을 보장하지 않습니다.';
  else if (['auth/invalid-credential','auth/invalid-login-credentials','auth/wrong-password','auth/user-not-found','auth/invalid-email'].includes(code)) message = '로그인 정보를 확인해주세요. 이 프로젝트에 등록된 교사 이메일과 Firebase 비밀번호를 사용하세요.';
  else if (code === 'auth/network-request-failed' || code === 'unavailable' || code === 'NETWORK_ERROR') message = '네트워크 연결을 확인해주세요. 입력한 이메일은 유지되며 자동으로 재시도하지 않습니다.';
  else if (code === 'auth/user-disabled') message = '이 테스트/교사 계정이 비활성화되어 있어요. 관리자에게 계정 상태를 확인해주세요.';
  else if (['auth/operation-not-allowed','auth/unauthorized-domain','auth/invalid-api-key'].includes(code)) message = '현재 프로젝트의 로그인 제공자·승인 도메인·웹 설정을 관리자에게 확인해주세요.';
  else if (['auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(code)) message = 'Google 로그인이 취소됐어요. 원할 때 다시 시작하세요.';
  else message = stage === 'database' ? '인증 후 DB 연결을 확인하지 못했어요. 관리자에게 DB 연결 상태를 확인해주세요.' : '로그인을 완료하지 못했어요. 아래 단계·오류 코드를 관리자에게 알려주세요.';
  if (testMode) message += ' 가상 교사 계정 전용 테스트입니다. 운영 교사 계정은 이 테스트에서 사용하지 마세요.';
  return { code, stage, message };
}
export function setupTeacherLogin({ elements: e, projectId, authenticateGoogle, authenticatePassword, prepare = async () => {}, allowGoogle = true, storage = globalThis.sessionStorage, clock = Date.now }) {
  const testMode = projectId === 'veteransgeo-test-2026', key = 'veteransgeo-auth-cooldown:' + projectId;
  let busy = false, stage = 'idle', until = 0;
  try { until = Number(storage?.getItem(key)) || 0; } catch {}
  const limited = () => until > clock();
  const pendingDatabase = () => stage === 'database' && !e.message.dataset.authCode;
  const buttons = () => { e.google.disabled = busy || pendingDatabase() || limited() || testMode || !allowGoogle; e.passwordButton.disabled = busy || pendingDatabase() || limited(); };
  const status = (next, error) => {
    stage = next; e.message.dataset.authStage = next; e.message.dataset.authCode = '';
    if (error) { const info = teacherAuthFailure(error, { stage: next, testMode }); e.message.textContent = info.message + ' [' + info.stage + ' · ' + info.code + ']'; e.message.dataset.authCode = info.code; }
    else e.message.textContent = ({ idle: testMode ? '가상 교사 계정으로 로그인 · 테스트 프로젝트 veteransgeo-test-2026' : '이 사이트에 등록된 교사 계정으로 로그인해주세요.', authentication: 'Firebase 인증 확인 중…', database: '인증 성공 · 승인 교사 DB 읽기 권한 확인 중…', ready: '인증 및 승인 교사 DB 읽기 권한 확인 완료' })[next] || '';
    buttons();
  };
  async function run(kind) {
    if (busy || pendingDatabase() || limited() || (kind === 'google' && (testMode || !allowGoogle))) return;
    const email = e.email.value.trim(), password = kind === 'password' ? e.password.value : '';
    if (kind === 'password' && (!email || !password)) { e.message.textContent = '이메일과 비밀번호를 모두 입력해주세요.'; e.password.value = ''; return; }
    busy = true; buttons(); status('authentication');
    try { await prepare(); await (kind === 'google' ? authenticateGoogle() : authenticatePassword(email, password)); if (stage === 'authentication') status('database'); }
    catch (error) {
      if (error?.code === 'auth/too-many-requests') { until = clock() + 15 * 60 * 1000; try { storage?.setItem(key, String(until)); } catch {} }
      status('authentication', error);
    } finally { e.password.value = ''; busy = false; buttons(); }
  }
  e.google.onclick = () => run('google'); e.passwordButton.onclick = () => run('password');
  e.password.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void run('password'); } });
  status('idle'); if (limited()) status('authentication', { code: 'auth/too-many-requests' }); buttons();
  return { status, isBusy: () => busy || pendingDatabase(), isLimited: limited };
}