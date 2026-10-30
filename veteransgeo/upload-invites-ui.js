import { PROJECT } from "./project-config.js";
import { acceptInvite, uploadAccessInfo, clearUploadAccess } from "./upload-access.js";
const schoolName = id => PROJECT.schools.find(s => s.id === id)?.school || id;
export function setupStudentInvites({ provider, auth, form, getIdentity, hasPending }) {
  if (!provider.usesInviteLinks) return () => {};
  const panel = document.createElement("div");
  panel.className = "media-hint";
  panel.innerHTML = '<p id="uploadAccessStatus" role="status">선생님이 준 업로드 링크로 접속하면 별도 인증코드 없이 파일을 올릴 수 있어요.</p><details><summary>새 업로드 링크로 다시 연결하기 · 글과 파일 유지</summary><p>선생님께 받은 새 링크 전체를 붙여 넣으세요. 새로고침할 필요가 없어요.</p><label>새 수업 링크<input type="url" autocomplete="off" spellcheck="false" placeholder="선생님이 준 링크 전체"></label><button type="button" class="gray">이 화면에서 연결</button></details>';
  form.querySelector("#workFileArea").prepend(panel);
  const status = panel.querySelector("[role=status]");
  let checking = false, live = true;
  async function refresh() {
    if (checking || !live || !auth.currentUser?.isAnonymous || !uploadAccessInfo().available) return;
    checking = true;
    const uid = getIdentity().uid;
    try {
      const r = await provider.authorizeUpload({ uid, token: await auth.currentUser.getIdToken() });
      if (!live || getIdentity().uid !== uid) return;
      const school = document.getElementById("school");
      // Never move an existing research/work draft to the invitation's school.
      const started = hasPending() || ["title", "introduction", "facilityName", "entryId"].some(k => form.elements[k].value.trim()) ||
        document.getElementById("placeName")?.value.trim() || document.getElementById("awarenessLocked")?.value;
      if (!started && school && school.value !== r.schoolId) {
        school.value = r.schoolId;
        school.dispatchEvent(new Event("change", { bubbles: true }));
      }
      status.textContent = `${schoolName(r.schoolId)} 업로드 연결 완료 · ${new Date(r.expiresAt).toLocaleTimeString("ko-KR")}까지. ${form.elements.schoolId.value !== r.schoolId ? "작성 중인 학교는 바꾸지 않았어요. 위에서 학교를 확인해주세요." : "별도 업로드 인증코드는 필요 없어요."}`;
    } catch (e) {
      if (live) status.textContent = e.code?.startsWith("media/") ? e.message : "학생 연결을 다시 확인해주세요. 글과 선택한 파일은 유지돼요.";
    } finally { checking = false; }
  }
  panel.querySelector("button").onclick = () => {
    const input = panel.querySelector("input"), raw = input.value;
    input.value = "";
    try {
      const url = new URL(raw);
      const currentPath = location.pathname.endsWith("/") ? location.pathname + "index.html" : location.pathname;
      if (url.origin !== location.origin || url.pathname !== currentPath || url.search) throw Error();
      const token = new URLSearchParams(url.hash.slice(1)).get("upload-invite");
      if (!/^i_[a-f0-9]{64}$/.test(token || "")) throw Error();
      acceptInvite(token);
    } catch { status.textContent = "이 학생 화면용 링크 전체를 다시 붙여 넣어주세요. 글과 선택한 파일은 유지돼요."; }
  };
  const changed = () => { if (!auth.currentUser?.isAnonymous) clearUploadAccess(); else refresh(); };
  const clearInput = () => { panel.querySelector("input").value = ""; };
  window.addEventListener("pagehide", clearInput);
  window.addEventListener("memory-upload-access", refresh);
  document.addEventListener("memory-auth-change", changed);
  refresh();
  return () => { live = false; clearInput(); clearUploadAccess(); window.removeEventListener("pagehide", clearInput); window.removeEventListener("memory-upload-access", refresh); document.removeEventListener("memory-auth-change", changed); };
}

export function setupTeacherInvites({ section, provider, user }) {
  if (!provider.enabled || !provider.usesInviteLinks) return () => {};
  const panel = document.createElement("details");
  panel.id = "teacherUploadInvites";
  panel.innerHTML = '<summary>학교별 시간 제한 업로드 링크 관리</summary><p>이 링크를 받은 학생은 업로드 인증코드를 입력하지 않아요. 활동코드는 기존대로 사용해요. 링크는 수업 안에서만 공유하고 공개 게시판·외부 QR 생성기에 넣지 마세요. 링크를 폐기해도 이미 제출한 작품은 유지돼요.</p><label>학교<select id="inviteSchool"></select></label><label>유효 시간<select id="inviteMinutes"><option value="15">15분</option><option value="30" selected>30분</option><option value="60">60분</option></select></label><p>학생 연결당 3작품 · 링크당 60작품 · 파일별 기존 용량 제한 적용</p><div class="media-toolbar"><button type="button" id="issueUploadInvite">수업 링크 발급</button><button type="button" id="refreshUploadInvites" class="gray">발급 내역 확인</button></div><div id="issuedUploadInvite" hidden><label>방금 발급한 링크 · 이 화면을 벗어나면 다시 표시하지 않아요<textarea readonly autocomplete="off" spellcheck="false"></textarea></label><button type="button" id="copyUploadInvite" class="gray">링크 복사</button></div><p id="inviteStatus" role="status"></p><ul id="uploadInviteList"></ul>';
  section.prepend(panel);
  const $ = s => panel.querySelector(s), select = $("#inviteSchool");
  for (const s of PROJECT.schools) select.add(new Option(s.school, s.id));
  let live = true, timer = null, currentId = null, revision = 0;
  const clear = () => { clearTimeout(timer); currentId = null; $("textarea").value = ""; $("#issuedUploadInvite").hidden = true; };
  const failure = e => { if (live) $("#inviteStatus").textContent = e.code?.startsWith("media/") ? e.message : "연결을 확인하고 다시 시도해주세요."; };
  async function list() {
    const version = ++revision, school = select.value;
    const rows = await provider.listInvites(school, await user.getIdToken());
    if (!live || version !== revision || school !== select.value) return;
    $("#uploadInviteList").replaceChildren();
    for (const r of rows) {
      const li = document.createElement("li"), button = document.createElement("button");
      const expired = Date.parse(r.expiresAt) <= Date.now();
      li.append(`${schoolName(r.schoolId)} · ${new Date(r.expiresAt).toLocaleString("ko-KR")}까지 · ${r.used}/${r.total}작품 · ${r.revoked ? "폐기됨" : expired ? "만료" : "유효"} `);
      button.type = "button"; button.className = "gray"; button.textContent = "즉시 폐기"; button.disabled = r.revoked || expired;
      button.onclick = async () => {
        button.disabled = true;
        try {
          await provider.revokeInvite(r.id, await user.getIdToken());
          if (!live) return;
          if (currentId === r.id) clear();
          $("#inviteStatus").textContent = "링크를 폐기했어요. 이 링크의 새 업로드는 차단돼요. 기존 작품은 유지돼요.";
          await list();
        } catch (e) { button.disabled = false; failure(e); }
      };
      li.append(button); $("#uploadInviteList").append(li);
    }
  }
  $("#issueUploadInvite").onclick = async () => {
    const button = $("#issueUploadInvite"), school = select.value;
    button.disabled = true; clear();
    try {
      const r = await provider.issueInvite({ schoolId: school, minutes: Number($("#inviteMinutes").value) }, await user.getIdToken());
      if (!live || select.value !== school) return;
      const url = new URL("./index.html", location.href);
      url.hash = "upload-invite=" + r.inviteToken;
      currentId = r.id; $("textarea").value = url.href; $("#issuedUploadInvite").hidden = false;
      timer = setTimeout(clear, Math.max(0, Date.parse(r.expiresAt) - Date.now()));
      $("#inviteStatus").textContent = "발급 완료. 필요한 학생에게만 전달하세요. 다시 표시할 수 없으니 분실하면 폐기 후 새로 발급하세요.";
      await list();
    } catch (e) { failure(e); }
    finally { if (live) button.disabled = false; }
  };
  $("#copyUploadInvite").onclick = async () => {
    try { await navigator.clipboard.writeText($("textarea").value); $("#inviteStatus").textContent = "복사했어요. 수업 종료 후 클립보드와 공유 메시지도 정리하세요."; }
    catch { $("textarea").select(); $("#inviteStatus").textContent = "선택된 링크를 직접 복사해주세요."; }
  };
  $("#refreshUploadInvites").onclick = () => list().catch(failure);
  select.onchange = () => { clear(); $("#uploadInviteList").replaceChildren(); list().catch(failure); };
  window.addEventListener("pagehide", clear);
  return () => { live = false; ++revision; clear(); window.removeEventListener("pagehide", clear); panel.remove(); };
}
