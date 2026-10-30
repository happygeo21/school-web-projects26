import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase,
  get,
  ref,
  push,
  set,
  onValue,
  update,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { PROJECT } from "./project-config.js";
import { DB_ROOT } from "./firebase-config.js";
import {
  MEDIA_TYPES,
  errorMessage,
  diagnostic,
  externalLink,
} from "./upgrade-core.js";
import { draftStore, opaquePublicId, safeTabStorage } from "./draft-store.js";
import { createMediaProvider, prepareFile } from "./media-provider.js";
import { WORK_STATUS, publicWork, waitForAck, databaseTimestamp, creationForRetry } from "./media-policy.js";
import { setupGallery } from "./media-gallery.js";
export { checkSignature } from "./media-policy.js";
const $ = (id) => document.getElementById(id),
  base = () => `${DB_ROOT}/works`;
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fields = (form) =>
  Object.fromEntries(
    [...new FormData(form)].filter(
      ([k, v]) => k !== "file" && k !== "consent" && k !== "uploadCode" && typeof v === "string",
    ),
  );
function workData(form) {
  const d = fields(form);
  for (const [k, max] of Object.entries({
    activityCode: 20,
    facilityName: 100,
    title: 100,
    introduction: 500,
    entryId: 120,
  })) {
    d[k] = String(d[k] || "").trim();
    if (d[k].length > max || (k !== "entryId" && !d[k]))
      throw Error("학교·활동코드·시설명·제목·소개 글을 확인해주세요.");
  }
  if (
    !PROJECT.schools.some((s) => s.id === d.schoolId) ||
    !MEDIA_TYPES.includes(d.type)
  )
    throw Error("학교와 작품 유형을 확인해주세요.");
  if (d.submissionMode === "external")
    d.externalUrl = externalLink(d.externalUrl);
  else {
    delete d.externalUrl;
    if (!["text", "upload"].includes(d.submissionMode))
      throw Error("제출 방식을 선택해주세요.");
  }
  return d;
}
export function setupStudentMedia({
  app,
  getIdentity,
  provider = createMediaProvider(),
}) {
  const box = document.createElement("section");
  box.id = "workSubmission";
  box.className = "card media-panel";
  box.hidden = true;
  box.innerHTML = `<h2>홍보 결과물 올리기</h2><p>탐구 기록 없이 작품만 제출해도 돼요. 선생님이 검토한 뒤 전시해요.</p><form id="mediaForm"><label>1. 작품 유형<select name="type">${MEDIA_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label><label>제출 방식<select name="submissionMode"><option value="text">글 작성</option><option value="upload">사진·영상·PDF 파일</option><option value="external">외부 링크</option></select></label><div id="workFileArea" hidden>${provider.requiresUploadCode ? '<label>파일 업로드 인증코드<input name="uploadCode" type="password" maxlength="128" autocomplete="off"><span class="media-hint">활동코드와 달라요. 선생님이 안내한 코드를 입력하세요. 저장하지 않습니다.</span></label>' : ''}<label>파일 한 개<input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf"></label><p class="media-hint">이미지 3MB · 영상 15MB · PDF 5MB. 이미지는 줄여서 올려요. 영상은 60초 이내 권장, 큰 영상은 외부 링크로 제출하세요.</p></div><div id="workLinkArea" hidden><label>외부 링크<input name="externalUrl" type="url" maxlength="2000" placeholder="https://drive.google.com/…"></label><p class="media-hint">Drive·문서·YouTube를 지원해요. 외부 원본의 공유 범위는 그 서비스에서 직접 확인해주세요.</p></div><label>2. 글 또는 간단한 설명<textarea name="introduction" maxlength="500" required placeholder="이 장소를 어떻게 기억하면 좋을까요?"></textarea></label><div class="media-fields"><label class="hidden" aria-hidden="true">학교<select name="schoolId">${PROJECT.schools.map((s) => `<option value="${s.id}">${escape(s.school)}</option>`).join("")}</select></label><p id="workSchoolDisplay" class="media-hint" role="status"></p><label>활동코드<input name="activityCode" maxlength="20" required></label><label>작품 제목<input name="title" maxlength="100" required></label><label>현충시설 이름<input name="facilityName" maxlength="100" required></label></div><details><summary>탐구 기록 연결 (선택)</summary><label>탐구 제출 ID<input name="entryId" maxlength="120"></label></details><div id="workPreview" class="media-preview" aria-live="polite">3. 파일을 선택하거나 글을 쓰면 미리 볼 수 있어요.</div><label><input type="checkbox" name="consent" required> 얼굴·이름·연락처·위치정보와 저작권을 확인했어요.</label><div class="media-toolbar"><button type="submit" class="primary">제출하기 · 실패 후 같은 작품으로 재시도</button><button type="button" id="cancelUpload" class="gray">업로드 취소</button><button type="button" id="clearWorkDraft" class="gray">새 작품 작성 · 초안 지우기</button></div><progress id="uploadProgress" max="100" value="0" aria-label="파일 전송 진행률"></progress><p id="uploadStatus" role="status"></p></form><h3>내 제출 상태</h3><p class="media-hint">이 기기의 현재 학생 연결로 제출한 작품만 볼 수 있어요. 다른 학생의 비공개 작품은 볼 수 없어요.</p><ul id="myWorkStatus" class="media-status-list"></ul>`;
  document.querySelector(".wrap").append(box);
  const form = $("mediaForm"),
    store = draftStore(safeTabStorage(), "memory:v3:work"),
    restored = store.read();
  let pending = restored?.pending || null,
    prepared = null,
    controller = null,
    busy = false,
    previewURL = null,
    fileEpoch = 0,
    ownUnsub = null,
    ownEpoch = 0;
  if (restored?.fields) {
    for (const [k, v] of Object.entries(restored.fields))
      if (form.elements[k] && typeof v === "string") form.elements[k].value = v;
  } else if (getIdentity().schoolId)
    form.elements.schoolId.value = getIdentity().schoolId;
  const save = () => store.save({ fields: fields(form), pending });
  const syncIdentity = () => {
    if (!pending) {
      const v = getIdentity();
      if (v.schoolId) form.elements.schoolId.value = v.schoolId;
      if (v.activityCode && !form.elements.activityCode.value)
        form.elements.activityCode.value = v.activityCode;
    }
    const selected = PROJECT.schools.find((s) => s.id === form.elements.schoolId.value);
    $("workSchoolDisplay").textContent = `제출 학교: ${selected?.school || "학교를 먼저 선택해주세요"} · 위에서 선택한 학교와 연결돼요.`;
  };
  const open = () => {
    box.hidden = false;
    syncIdentity();
    box.scrollIntoView({ behavior: "smooth" });
    form.elements.type.focus();
  };
  $("openWorkSubmission")?.addEventListener("click", open);
  function renderPreview() {
    const el = $("workPreview");
    el.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = form.elements.title.value || "우리의 기억을 전해요";
    el.append(title);
    const text = document.createElement("p");
    text.textContent =
      form.elements.introduction.value || "작품 소개를 입력해주세요.";
    el.append(text);
    if (previewURL && prepared) {
      const v = document.createElement(
        prepared.file.type.startsWith("video/")
          ? "video"
          : prepared.file.type.startsWith("image/")
            ? "img"
            : "a",
      );
      if (v.tagName === "A") {
        v.href = previewURL;
        v.textContent = "선택한 PDF 미리보기";
        v.target = "_blank";
        v.rel = "noopener";
      } else {
        v.src = previewURL;
        if (v.tagName === "VIDEO") {
          v.controls = true;
          v.preload = "metadata";
        } else v.alt = "선택한 작품 미리보기";
      }
      el.append(v);
    }
  }
  function mode() {
    const value = form.elements.submissionMode.value;
    $("workFileArea").hidden = value !== "upload";
    if (form.elements.uploadCode) form.elements.uploadCode.required = value === "upload";
    $("workLinkArea").hidden = value !== "external";
    form.elements.externalUrl.required = value === "external";
  }
  if (!provider.enabled) {
    form.elements.submissionMode.querySelector("[value=upload]").disabled =
      true;
    if (form.elements.submissionMode.value === "upload")
      form.elements.submissionMode.value = "text";
    $("uploadStatus").textContent =
      "파일 저장소는 아직 연결 전이에요. 글·외부 링크로 제출할 수 있어요.";
  }
  form.addEventListener("input", () => {
    save();
    renderPreview();
  });
  form.addEventListener("change", () => {
    save();
    mode();
  });
  window.addEventListener("pagehide", save);
  mode();
  renderPreview();
  form.elements.file.onchange = async () => {
    const epoch = ++fileEpoch;
    prepared = null;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
    try {
      const selected = form.elements.file.files[0];
      if (!selected) return;
      const result = await prepareFile(selected);
      if (epoch !== fileEpoch) return;
      prepared = result;
      previewURL = URL.createObjectURL(result.file);
      renderPreview();
      $("uploadStatus").textContent =
        `파일 준비 완료 · ${(result.file.size / 1024 ** 2).toFixed(2)}MB. ${result.file.type.startsWith("image/") ? "이미지 위치 메타데이터는 재인코딩으로 제거했어요. 얼굴·보이는 개인정보는 직접 확인하세요." : "영상·PDF의 위치정보와 문서 속성은 직접 지워주세요."}`;
    } catch (e) {
      if (epoch === fileEpoch) $("uploadStatus").textContent = e.message;
    } finally {
      renderPreview();
    }
  };
  async function ownStatus() {
    const epoch = ++ownEpoch;
    ownUnsub?.();
    ownUnsub = null;
    $("myWorkStatus").replaceChildren();
    const uid = getIdentity().uid;
    if (!uid) return;
    ownUnsub = onValue(
      ref(getDatabase(app), `${base()}/${form.elements.schoolId.value}/${uid}`),
      (s) => {
        if (epoch !== ownEpoch) return;
        $("myWorkStatus").replaceChildren();
        for (const w of Object.values(s.val() || {})
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 15)) {
          const li = document.createElement("li");
          li.textContent = `${w.title} · ${WORK_STATUS[w.status] || "확인 중"}`;
          $("myWorkStatus").append(li);
        }
      },
      () => {
        if (epoch === ownEpoch)
          $("myWorkStatus").textContent =
            "제출 상태를 읽지 못했어요. 저장 여부는 선생님께 확인해주세요.";
      },
    );
  }
  form.elements.schoolId.addEventListener("change", ownStatus);
  document.getElementById("school")?.addEventListener("change", () => {
    if (!pending) { syncIdentity(); ownStatus(); }
  });
  const authUnsub = onAuthStateChanged(getAuth(app), () => {
    if (!getAuth(app).currentUser?.isAnonymous) {
      ++ownEpoch;
      ownUnsub?.();
      ownUnsub = null;
      $("myWorkStatus").textContent = "학생 연결을 확인해주세요.";
    } else ownStatus();
  });
  document.addEventListener("memory-auth-change", ownStatus);
  document.addEventListener("memory-work-facility", (e) => {
    if (!pending) {
      form.elements.facilityName.value = String(e.detail.name || "").slice(
        0,
        100,
      );
      save();
    }
  });
  const clear = () => {
    ++fileEpoch;
    controller?.abort();
    pending = null;
    prepared = null;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
    form.reset();
    syncIdentity();
    mode();
    renderPreview();
    store.clear();
  };
  $("clearWorkDraft").onclick = () => {
    if (
      !busy &&
      confirm(
        "이 작품 초안을 지우고 새로 쓸까요? 이미 제출한 원본은 지워지지 않아요.",
      )
    )
      clear();
  };
  $("cancelUpload").onclick = () => {
    if (controller) {
      controller.abort();
      $("uploadStatus").textContent =
        "업로드를 취소했어요. 글과 선택한 파일은 유지했어요.";
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (busy || !form.reportValidity()) return;
    const button = form.querySelector("button[type=submit]");
    try {
      const identity = getIdentity(),
        uid = identity.uid;
      if (!uid || !getAuth(app).currentUser?.isAnonymous)
        throw { code: "auth/not-connected" };
      if (pending?.owner && pending.owner !== uid)
        throw Error(
          "작성 계정이 바뀌었어요. 이전 작품을 다른 계정으로 전송하지 않아요.",
        );
      const d = workData(form);
      if (pending && pending.identity !== `${d.schoolId}/${uid}`)
        throw Error(
          "재시도할 때는 같은 학교를 선택해주세요. 새 작품은 초안 지우기를 눌러주세요.",
        );
      if (
        pending?.data &&
        Object.entries(d).some(([k, v]) => v !== (pending.data[k] ?? ""))
      )
        throw Error(
          "첫 전송 내용과 달라졌어요. 중복을 막기 위해 원래 내용으로 재시도하거나, 글을 따로 보관한 뒤 새 작품 작성을 눌러주세요.",
        );
      if (d.submissionMode === "upload" && (!provider.enabled || !prepared))
        throw Error(
          "올릴 파일을 다시 선택해주세요. 새로고침 후에는 같은 파일을 골라주세요.",
        );
      const db = getDatabase(app);
      pending = pending || {
        identity: `${d.schoolId}/${uid}`,
        owner: uid,
        key: push(ref(db, `${base()}/${d.schoolId}/${uid}`)).key,
        createdAt: Date.now(),
      };
      if (!pending.data) {
        const original = { ...d };
        pending.data = {
          ...d,
          status: "pending",
          createdAt: pending.createdAt,
          studentOriginal: original,
          ...(d.submissionMode === "upload"
            ? {
                mediaProvider: "gateway",
                mediaAssetId: await opaquePublicId(
                  `${d.schoolId}_${uid}_${pending.key}`,
                ),
                contentType: prepared.file.type,
                size: prepared.file.size,
                sha256: prepared.sha256,
              }
            : {}),
        };
      }
      if (
        pending.data.submissionMode === "upload" &&
        prepared?.sha256 !== pending.data.sha256
      )
        throw Error(
          "최초 제출 때와 같은 파일을 선택해주세요. 다른 파일은 새 작품으로 제출해주세요.",
        );
      save();
      busy = true;
      $("uploadProgress").value = 0;
      button.disabled = true;
      controller = new AbortController();
      $("uploadStatus").textContent = "작품 정보를 저장하고 있어요…";
      const token = await getAuth(app).currentUser.getIdToken();
      if (getIdentity().uid !== uid) throw { code: "auth/user-changed" };
      const target = ref(db, `${base()}/${pending.identity}/${pending.key}`);
      const existing = await get(target);
      const writeData = creationForRetry(pending.data, existing.exists() ? existing.val() : null);
      await waitForAck(set(target, writeData), controller.signal);
      if (pending.data.submissionMode === "upload") {
        if (controller.signal.aborted)
          throw Error("취소했어요. 같은 작품으로 다시 시도해주세요.");
        $("uploadStatus").textContent =
          "파일을 올리고 있어요. 끝날 때까지 기다려주세요…";
        const result = await provider.upload({
          file: prepared.file,
          schoolId: pending.data.schoolId,
          workId: pending.key,
          activityCode: pending.data.activityCode,
          uploadCode: form.elements.uploadCode?.value,
          token,
          signal: controller.signal,
          onProgress: (n) => ($("uploadProgress").value = n),
        });
        if (result.warning)
          $("uploadStatus").textContent =
            "무료 저장공간이 70% 이상이에요. 선생님께 알려주세요.";
      }
      clear();
      if (form.elements.uploadCode) form.elements.uploadCode.value = "";
      $("uploadProgress").value = 100;
      $("uploadStatus").textContent =
        "제출 완료! 선생님 검토를 기다리고 있어요.";
      ownStatus();
    } catch (err) {
      diagnostic("media", err);
      $("uploadStatus").textContent = String(err.code || "").startsWith(
        "media/",
      )
        ? err.message
        : err.code
          ? errorMessage(err)
          : err.message || "다시 확인해주세요.";
      save();
    } finally {
      busy = false;
      button.disabled = false;
      controller = null;
    }
  };
  return () => {
    authUnsub();
    ownUnsub?.();
    controller?.abort();
    if (previewURL) URL.revokeObjectURL(previewURL);
  };
}
export function setupTeacherMedia({
  app,
  db,
  user,
  subscribe,
  provider = createMediaProvider(),
}) {
  const section = document.createElement("section");
  section.className = "card";
  section.id = "teacherWorks";
  section.innerHTML = `<h2>홍보 작품 관리</h2><p>얼굴·개인정보·저작권·사실관계를 확인한 뒤 승인해주세요. 파일은 승인 전 비공개이며, 승인 해제 후 새 미디어 요청도 차단됩니다. 이미 받은 사본은 회수할 수 없어요.</p><label>상태<select id="workFilter"><option value="ALL">전체</option>${Object.entries(
    WORK_STATUS,
  )
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join(
      "",
    )}</select></label><label>학교·시설·제목 검색<input id="workSearch" maxlength="100"></label><div class="media-toolbar"><button id="mediaUsage" class="gray">무료 사용량 확인</button><button id="reconcileMedia" class="gray">미디어 상태 점검·고아 파일 정리</button></div><p id="workStatus" role="status"></p><div id="workList"></div>`;
  $("dash").append(section);
  let records = {},
    live = true,
    sequence = 0,
    urls = [];
  const fail = (e) => {
    if (live) {
      diagnostic("review", e);
      $("workStatus").textContent = String(e.code || "").startsWith("media/")
        ? e.message
        : e.code
          ? errorMessage(e)
          : e.message;
    }
  };
  const token = () => user.getIdToken();
  $("reconcileMedia").disabled = !provider.enabled;
  $("mediaUsage").disabled = !provider.enabled;
  $("mediaUsage").onclick = async () => {
    try {
      const r = await provider.usage(await token()),
        percent = Math.round(
          ((r.objectBytes + r.reservedBytes) / r.capacity) * 100,
        );
      $("workStatus").textContent =
        `스토리지 메타데이터·예약 기준 ${percent}%${percent >= 70 ? " · 70% 이상 경고" : ""}${percent >= 90 ? " · 신규 영상 제한" : ""}. 전송량 ${Math.round(r.estimatedTransferBytes / 1024 ** 2)}MB는 앱 추정치예요. 실제 요금제 사용량은 Supabase Dashboard에서 확인하세요.`;
    } catch (e) {
      fail(e);
    }
  };
  $("reconcileMedia").onclick = async () => {
    try {
      if (
        !confirm(
          "파일 상태를 대조하고 보관 기간이 지난 파일을 정리할까요? 학생 원본·이력은 유지합니다.",
        )
      )
        return;
      const r = await provider.reconcile(await token());
      $("workStatus").textContent =
        `점검 ${r.checked}개 · 정리 ${r.deleted}개 · 복구 ${r.repaired}개. 잔여 항목은 다시 점검하세요.`;
    } catch (e) {
      fail(e);
    }
  };
  async function render() {
    const version = ++sequence;
    urls.forEach((f) => f());
    urls = [];
    $("workList").replaceChildren();
    for (const [school, users] of Object.entries(records))
      for (const [uid, items] of Object.entries(users || {}))
        for (const [id, w] of Object.entries(items || {})) {
          if (
            $("workFilter").value !== "ALL" &&
            $("workFilter").value !== w.status
          )
            continue;
          const q = $("workSearch").value.trim();
          if (q && !`${school} ${w.facilityName} ${w.title}`.includes(q))
            continue;
          const key = await opaquePublicId(`${school}_${uid}_${id}`);
          if (!live || version !== sequence) return;
          const privatePath = `${base()}/${school}/${uid}/${id}`,
            legacyKey = `${school}_${uid}_${id}`,
            location = { schoolId: school, ownerUid: uid, workId: id };
          const entry = document.createElement("article");
          entry.className = "work-review";
          entry.innerHTML = `<h3>${escape(w.title)}</h3><p>${escape(PROJECT.schools.find((s) => s.id === school)?.school || school)} · ${escape(w.facilityName)} · ${escape(w.type)} · <span class="media-state">${escape(WORK_STATUS[w.status] || w.status)}</span></p><p>${escape(w.introduction)}</p><p class="media-hint">${escape(new Date(w.createdAt).toLocaleString("ko-KR"))}</p>`;
          async function review(status, patch = {}) {
            const current = await get(ref(db, privatePath));
            if (
              !current.exists() ||
              (current.val().revision || 0) !== (w.revision || 0)
            )
              throw Error(
                "다른 교사의 변경이 있어요. 목록을 다시 확인해주세요.",
              );
            const timestamp = databaseTimestamp(),
              after = {
                ...w,
                ...patch,
                status,
                reviewedBy: user.uid,
                reviewedAt: timestamp,
                revision: (w.revision || 0) + 1,
              },
              changes = {};
            for (const [field, value] of Object.entries({
              ...patch,
              status,
              reviewedBy: user.uid,
              reviewedAt: timestamp,
              revision: after.revision,
            }))
              changes[`${privatePath}/${field}`] = value;
            changes[`${DB_ROOT}/publishedWorks/${key}`] =
              status === "approved" ? publicWork(after, key, timestamp) : null;
            changes[`${DB_ROOT}/publishedWorks/${legacyKey}`] = null;
            changes[
              `${DB_ROOT}/workAudit/${legacyKey}/${push(ref(db, `${DB_ROOT}/workAudit/${legacyKey}`)).key}`
            ] = { before: w, after, editor: user.uid, editedAt: timestamp };
            // RTDB publication and status change together. Gateway checks this projection on EVERY media request.
            await update(ref(db), changes);
            $("workStatus").textContent = "검토 결과를 저장했어요.";
          }
          const button = (label, fn) => {
            const b = document.createElement("button");
            b.className = "gray";
            b.textContent = label;
            b.onclick = async () => {
              b.disabled = true;
              try {
                await fn();
              } catch (e) {
                fail(e);
              } finally {
                b.disabled = false;
              }
            };
            entry.append(b);
          };
          button("미리보기", async () => {
            if (w.submissionMode === "text") return;
            if (w.submissionMode === "external") {
              const a = document.createElement("a");
              a.href = externalLink(w.externalUrl);
              a.target = "_blank";
              a.rel = "noopener noreferrer";
              a.textContent = "외부 원본 확인";
              entry.append(a);
              return;
            }
            if (w.mediaProvider !== "gateway")
              throw Error(
                "이전 Firebase Storage 파일은 이 무료 Provider로 자동 이전하지 않아요.",
              );
            const blob = await provider.preview(location, await token());
            if (!live || version !== sequence) return;
            const url = URL.createObjectURL(blob);
            urls.push(() => URL.revokeObjectURL(url));
            const el = document.createElement(
              w.contentType.startsWith("video/")
                ? "video"
                : w.contentType.startsWith("image/")
                  ? "img"
                  : "a",
            );
            if (el.tagName === "A") {
              el.href = url;
              el.target = "_blank";
              el.rel = "noopener";
              el.textContent = "PDF 원본 검토";
            } else {
              el.src = url;
              if (el.tagName === "VIDEO") {
                el.controls = true;
                el.preload = "metadata";
              } else el.alt = "비공개 검토 작품";
            }
            entry.append(el);
          });
          button("검토 후 공개 승인", async () => {
            if (w.status === "archived")
              throw Error("보관한 작품은 복원 후 검토해주세요.");
            if (w.submissionMode === "upload") {
              if (w.mediaProvider !== "gateway")
                throw Error("이전 저장소 파일은 수동 검토가 필요해요.");
              const r = await provider.inspect(location, await token());
              if (r.state !== "ready")
                throw Error(
                  "파일 업로드가 끝나지 않았어요. 상태 점검 후 다시 확인해주세요.",
                );
            }
            if (
              confirm(
                "얼굴·개인정보·위치정보·저작권·사실관계를 모두 검토했나요?",
              )
            )
              await review("approved");
          });
          for (const [label, status] of [
            ["수정 요청", "changes_requested"],
            ["반려", "rejected"],
            ["비공개 전환", "private"],
            ["보관", "archived"],
          ])
            button(label, () => review(status));
          if (w.status === "archived") button("복원", () => review("pending"));
          button("제목·소개 수정", async () => {
            const title = prompt("작품 제목", w.title);
            if (title === null) return;
            const introduction = prompt("소개 글", w.introduction);
            if (introduction === null) return;
            if (
              !title.trim() ||
              title.length > 100 ||
              !introduction.trim() ||
              introduction.length > 500
            )
              throw Error("제목·소개 글 길이를 확인해주세요.");
            await review("pending", {
              title: title.trim(),
              introduction: introduction.trim(),
            });
          });
          button("수정 이력", async () => {
            const s = await get(ref(db, `${DB_ROOT}/workAudit/${legacyKey}`));
            if (!live) return;
            const dialog = document.createElement("dialog");
            dialog.className = "media-detail";
            const pre = document.createElement("pre");
            pre.textContent = JSON.stringify(s.val() || {}, null, 2);
            const close = document.createElement("button");
            close.textContent = "닫기";
            close.onclick = () => dialog.close();
            dialog.append(close, pre);
            document.body.append(dialog);
            dialog.onclose = () => dialog.remove();
            dialog.showModal();
          });
          button("학생 원본 보기", () => {
            const dialog = document.createElement("dialog");
            dialog.className = "media-detail";
            const pre = document.createElement("pre");
            pre.textContent = JSON.stringify(
              w.studentOriginal || {
                notice:
                  "이전 형식은 별도 원본이 없어 첫 수정 이력의 before를 확인해주세요.",
              },
              null,
              2,
            );
            const close = document.createElement("button");
            close.textContent = "닫기";
            close.onclick = () => dialog.close();
            dialog.append(close, pre);
            document.body.append(dialog);
            dialog.onclose = () => dialog.remove();
            dialog.showModal();
          });
          $("workList").append(entry);
        }
  }
  $("workFilter").onchange = render;
  $("workSearch").oninput = render;
  subscribe(
    onValue(
      ref(db, base()),
      (snap) => {
        records = snap.val() || {};
        render();
      },
      fail,
    ),
  );
  return () => {
    live = false;
    ++sequence;
    urls.forEach((f) => f());
    section.remove();
  };
}
export function setupPublicMedia({
  app,
  db,
  provider = createMediaProvider(),
  findFacility,
}) {
  return setupGallery({
    provider,
    findFacility,
    subscribe: (fn) =>
      onValue(
        ref(db, `${DB_ROOT}/publishedWorks`),
        (s) => fn(s.val() || {}),
        () => {
          $("galleryStatus").textContent =
            "공개 작품 목록 권한·연결을 확인해주세요.";
        },
      ),
  });
}
