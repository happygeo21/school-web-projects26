import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getBlob,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { PROJECT, MEDIA_UPLOAD_ENABLED } from "./project-config.js";
import { DB_ROOT } from "./firebase-config.js";
import {
  MEDIA_TYPES,
  checkFile,
  errorMessage,
  diagnostic,
  externalLink,
} from "./upgrade-core.js";
const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const base = () => `${DB_ROOT}/works`;
function workData(form) {
  const d = Object.fromEntries(new FormData(form));
  for (const [k, max] of Object.entries({
    activityCode: 20,
    facilityName: 100,
    title: 100,
    introduction: 500,
    entryId: 120,
  })) {
    d[k] = String(d[k] || "").trim();
    if (d[k].length > max || (!["entryId"].includes(k) && !d[k]))
      throw Error("학교·활동코드·시설명·제목·소개 글을 확인해주세요.");
  }
  if (
    !PROJECT.schools.some((s) => s.id === d.schoolId) ||
    !MEDIA_TYPES.includes(d.type)
  )
    throw Error("학교와 작품 유형을 확인해주세요.");
  delete d.file;
  delete d.consent;
  return d;
}
// Reject embedded SVG/HTML and video/PDF disguises by checking file signatures too.
export async function checkSignature(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const s = String.fromCharCode(...b);
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
              : file.type === "application/pdf"
                ? s.startsWith("%PDF-")
                : false;
  if (!ok)
    throw Error(
      "파일 내용과 형식이 맞지 않아요. 원본 파일을 다시 확인해주세요.",
    );
}
export function setupStudentMedia({ app, getIdentity }) {
  const box = document.createElement("section");
  box.className = "card";
  box.innerHTML = `<h2>홍보 결과물 올리기</h2><p>탐구 기록 없이 작품만 제출해도 돼요. 얼굴·이름·연락처·사진 위치정보를 지우고, 직접 만들었거나 사용 허락을 받은 파일만 올리세요. 교사 검토 전에는 공개하지 않아요.</p><form id="mediaForm"><label>학교<select name="schoolId">${PROJECT.schools.map((s) => `<option value="${s.id}">${escape(s.school)}</option>`).join("")}</select></label><label>활동코드<input name="activityCode" maxlength="20" required></label><label>시설명<input name="facilityName" maxlength="100" required></label><label>작품 제목<input name="title" maxlength="100" required></label><label>유형<select name="type">${MEDIA_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label><label>소개 글<textarea name="introduction" maxlength="500" required></textarea></label><label>탐구 제출 ID (선택)<input name="entryId" maxlength="120"></label><label>제출 방식<select name="submissionMode"><option value="text">텍스트 소개·홍보 기획안</option><option value="external">외부 자료 링크</option><option value="upload">직접 파일 업로드 (설정 확인 후)</option></select></label><label>외부 자료 링크<input name="externalUrl" type="url" maxlength="2000" placeholder="https://drive.google.com/…"></label><p>Google Drive·문서·YouTube 링크만 지원합니다. 원본의 공개 범위는 해당 서비스에서 직접 정해야 해요. 링크 제출만으로 원본이 비공개가 되지는 않아요. 승인 전 링크는 이 앱의 공개 화면에 표시하지 않습니다.</p><label>파일<input type="file" name="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf"></label><p>이미지 10MB · 영상 100MB · PDF 20MB. 브라우저는 실제 파일 내용 검사도 하지만, 공개 전 교사가 파일을 직접 확인해야 해요.</p><label><input type="checkbox" name="consent" required style="width:auto"> 개인정보·위치정보·저작권을 확인했어요.</label><button class="primary">작품 제출 · 실패 후 같은 작품으로 재시도</button><button type="button" id="cancelUpload" class="gray">진행 취소</button><progress id="uploadProgress" max="100" value="0" style="width:100%"></progress><p id="uploadStatus" role="status"></p></form>`;
  document.querySelector(".wrap").append(box);
  let pending = null,
    task = null;
  const form = $("mediaForm");
  if (!MEDIA_UPLOAD_ENABLED) {
    form.elements.submissionMode.querySelector("[value=upload]").disabled =
      true;
    $("uploadStatus").textContent =
      "텍스트·외부 링크로 제출할 수 있어요. 직접 파일 업로드는 저장소·요금제·보안 설정 확인 전까지 닫혀 있어요.";
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("button");
    try {
      const { uid } = getIdentity();
      if (!uid || !app) throw { code: "auth/not-connected" };
      const data = workData(form),
        file = form.elements.file.files[0];
      if (data.submissionMode === "upload") {
        if (!MEDIA_UPLOAD_ENABLED)
          throw Error("파일 업로드는 아직 준비 중이에요.");
        checkFile(file);
        await checkSignature(file);
      } else if (data.submissionMode === "external")
        data.externalUrl = externalLink(data.externalUrl);
      else if (data.submissionMode !== "text")
        throw Error("제출 방식을 선택해주세요.");
      const db = getDatabase(app),
        identity = `${data.schoolId}/${uid}`;
      if (!pending || pending.identity !== identity)
        pending = {
          identity,
          key: push(ref(db, base() + "/" + identity)).key,
          createdAt: Date.now(),
        };
      const path = `student-media/${pending.identity}/${pending.key}/file`;
      button.disabled = true;
      if (data.submissionMode !== "upload") {
        delete data.file;
        await set(ref(db, `${base()}/${pending.identity}/${pending.key}`), {
          ...data,
          status: "pending",
          createdAt: pending.createdAt,
        });
        $("uploadStatus").textContent =
          "제출 완료! 선생님이 링크 내용을 검토한 뒤 공개할 수 있어요.";
        pending = null;
        form.reset();
        return;
      }
      $("uploadStatus").textContent = "파일을 올리고 있어요…";
      task = uploadBytesResumable(storageRef(getStorage(app), path), file, {
        contentType: file.type,
        cacheControl: "private,max-age=0",
      });
      await new Promise((resolve, reject) =>
        task.on(
          "state_changed",
          (snap) =>
            ($("uploadProgress").value = Math.round(
              (100 * snap.bytesTransferred) / snap.totalBytes,
            )),
          reject,
          resolve,
        ),
      );
      await set(ref(db, `${base()}/${pending.identity}/${pending.key}`), {
        ...data,
        storagePath: path,
        contentType: file.type,
        size: file.size,
        status: "pending",
        createdAt: pending.createdAt,
      });
      $("uploadStatus").textContent =
        "제출 완료! 선생님이 검토한 뒤 공개할 수 있어요.";
      pending = null;
      form.reset();
    } catch (err) {
      diagnostic("media", err);
      $("uploadStatus").textContent = err.code
        ? errorMessage(err)
        : err.message || "파일을 다시 확인해주세요.";
    } finally {
      button.disabled = false;
      task = null;
    }
  };
  $("cancelUpload").onclick = () => task?.cancel();
}
async function preview(app, path, element, mime) {
  const blob = await getBlob(storageRef(getStorage(app), path));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.textContent = "검토 파일 열기 (다운로드)";
  a.download = "review-file";
  element.append(a);
  if (mime.startsWith("image/")) {
    const img = new Image();
    img.src = url;
    img.alt = "작품 미리보기";
    img.style.maxWidth = "100%";
    element.append(img);
  }
  if (mime.startsWith("video/")) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = url;
    video.style.maxWidth = "100%";
    element.append(video);
  }
  return () => URL.revokeObjectURL(url);
}
export function setupTeacherMedia({ app, db, user, subscribe }) {
  const section = document.createElement("section");
  section.className = "card";
  section.innerHTML =
    '<h2>학생 홍보 작품 검토</h2><p>공개 전 얼굴·개인정보·EXIF 위치정보·저작권·사실관계를 직접 확인하세요. 승인한 파일의 별도 공개 사본만 전시에 사용합니다.</p><p role="status" id="workStatus"></p><div id="workList"></div>';
  $("dash").append(section);
  let urls = [], live = true;
  const fail = (e) => {
    if(!live)return;
    diagnostic("review", e);
    $("workStatus").textContent = errorMessage(e);
  };
  subscribe(
    onValue(
      ref(db, base()),
      (snap) => {
        if(!live)return;
        urls.forEach((f) => f());
        urls = [];
        $("workList").replaceChildren();
        for (const [school, users] of Object.entries(snap.val() || {}))
          for (const [uid, works] of Object.entries(users))
            for (const [id, w] of Object.entries(works)) {
              const entry = document.createElement("article");
              entry.className = "entry";
              entry.innerHTML = `<h3>${escape(w.title)}</h3><p>${escape(w.schoolId)} · ${escape(w.facilityName)} · ${escape(w.type)} · ${escape(w.status)}</p><p>${escape(w.introduction)}</p>`;
              const key = `${school}_${uid}_${id}`,
                privateRef = ref(db, `${base()}/${school}/${uid}/${id}`),
                publicRef = ref(db, `${DB_ROOT}/publishedWorks/${key}`),
                publicPath = `published-media/${key}/file`;
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
                if (w.submissionMode === "text") {
                  entry.append(
                    document.createTextNode("위 소개 글을 검토해주세요."),
                  );
                } else if (w.submissionMode === "external") {
                  const a = document.createElement("a");
                  a.href = externalLink(w.externalUrl);
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  a.textContent = "외부 자료 검토 (새 창)";
                  entry.append(a);
                } else
                  urls.push(
                    await preview(app, w.storagePath, entry, w.contentType),
                  );
              });
              async function unpublish() {
                if (["external", "text"].includes(w.submissionMode)) {
                  await remove(publicRef);
                  return;
                }
                try {
                  await deleteObject(storageRef(getStorage(app), publicPath));
                } catch (e) {
                  if (e.code !== "storage/object-not-found") throw e;
                }
                await remove(publicRef);
              }
              button("검토 후 공개 승인", async () => {
                if (
                  !["external", "text"].includes(w.submissionMode) &&
                  !MEDIA_UPLOAD_ENABLED
                )
                  throw Error(
                    "Storage 설정 검토 후 업로드 기능을 활성화해주세요.",
                  );
                if (
                  !confirm(
                    "얼굴·개인정보·위치정보·저작권·사실관계를 검토했나요? 공개 사본이 생성됩니다.",
                  )
                )
                  return;
                if (["external", "text"].includes(w.submissionMode)) {
                  await set(publicRef, {
                    schoolId: school,
                    facilityName: w.facilityName,
                    title: w.title,
                    type: w.type,
                    introduction: w.introduction,
                    entryId: w.entryId || "",
                    submissionMode: w.submissionMode,
                    ...(w.submissionMode === "external"
                      ? { externalUrl: externalLink(w.externalUrl) }
                      : {}),
                    approvedAt: Date.now(),
                    status: "approved",
                  });
                  await update(privateRef, {
                    status: "approved",
                    reviewedAt: Date.now(),
                    reviewedBy: user.uid,
                  });
                  return;
                }
                const file = await getBlob(
                  storageRef(getStorage(app), w.storagePath),
                );
                checkFile({ type: w.contentType, size: file.size });
                await uploadBytesResumable(
                  storageRef(getStorage(app), publicPath),
                  file,
                  {
                    contentType: w.contentType,
                    customMetadata: { approved: "true" },
                    cacheControl: "no-store",
                  },
                );
                await set(publicRef, {
                  schoolId: school,
                  facilityName: w.facilityName,
                  title: w.title,
                  type: w.type,
                  introduction: w.introduction,
                  entryId: w.entryId || "",
                  storagePath: publicPath,
                  contentType: w.contentType,
                  approvedAt: Date.now(),
                  status: "approved",
                });
                await update(privateRef, {
                  status: "approved",
                  reviewedAt: Date.now(),
                  reviewedBy: user.uid,
                });
              });
              for (const [label, status] of [
                ["반려", "rejected"],
                ["비공개 전환", "private"],
              ])
                button(label, async () => {
                  await unpublish();
                  await update(privateRef, {
                    status,
                    reviewedAt: Date.now(),
                    reviewedBy: user.uid,
                  });
                });
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
                await unpublish();
                await update(privateRef, {
                  title,
                  introduction,
                  status: "pending",
                  reviewedAt: Date.now(),
                  reviewedBy: user.uid,
                });
              });
              $("workList").append(entry);
            }
      },
      fail,
    ),
  );
  return () => {
    live=false;
    urls.forEach((f) => f());
    section.remove();
  };
}
export function setupPublicMedia({ app, db }) {
  const section = document.createElement("section");
  section.className = "card";
  section.id = "gallery";
  section.innerHTML = `<h2>승인된 홍보 작품 전시</h2><label>학교<select id="gallerySchool"><option value="ALL">전체 학교</option>${PROJECT.schools.map((s) => `<option value="${s.id}">${escape(s.school)}</option>`).join("")}</select></label><label>시설명 검색<input id="galleryFacility" maxlength="100"></label><label>유형<select id="galleryType"><option value="ALL">전체 유형</option>${MEDIA_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label><p id="galleryStatus" role="status"></p><div id="galleryItems"></div>`;
  document.querySelector(".wrap").append(section);
  let works = [],
    urls = [];
  const render = () => {
    urls.forEach((f) => f());
    urls = [];
    $("galleryItems").replaceChildren();
    const selected = works.filter(
      (w) =>
        w.status === "approved" &&
        ($("gallerySchool").value === "ALL" ||
          $("gallerySchool").value === w.schoolId) &&
        ($("galleryType").value === "ALL" ||
          $("galleryType").value === w.type) &&
        w.facilityName.includes($("galleryFacility").value.trim()),
    );
    for (const w of selected) {
      const e = document.createElement("article");
      e.className = "entry";
      e.innerHTML = `<h3>${escape(w.title)}</h3><p>${escape(w.facilityName)} · ${escape(w.type)}</p><p>${escape(w.introduction)}</p>`;
      const b = document.createElement("button");
      b.textContent = "승인 작품 보기";
      b.onclick = async () => {
        try {
          if (w.submissionMode === "text") {
            e.append(document.createTextNode("승인된 텍스트 작품입니다."));
          } else if (w.submissionMode === "external") {
            const a = document.createElement("a");
            a.href = externalLink(w.externalUrl);
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = "승인된 외부 자료 열기";
            e.append(a);
          } else urls.push(await preview(app, w.storagePath, e, w.contentType));
          b.disabled = true;
        } catch {
          $("galleryStatus").textContent =
            "지금 작품을 열 수 없어요. 비공개 전환되었거나 연결을 확인해야 합니다.";
        }
      };
      e.append(b);
      $("galleryItems").append(e);
    }
    $("galleryStatus").textContent = `승인 작품 ${selected.length}개`;
  };
  for (const id of ["gallerySchool", "galleryFacility", "galleryType"])
    $(id).addEventListener("input", render);
  onValue(
    ref(db, `${DB_ROOT}/publishedWorks`),
    (s) => {
      works = Object.values(s.val() || {});
      render();
    },
    () => {
      $("galleryStatus").textContent =
        "공개 작품 목록 권한·연결을 확인해주세요.";
    },
  );
  document.addEventListener("memory-facility-selected", (e) => {
    $("galleryFacility").value = e.detail.name;
    $("gallerySchool").value = e.detail.schoolId;
    render();
    section.scrollIntoView({ behavior: "smooth" });
  });
}
