import { PROJECT } from "./project-config.js";
import { MEDIA_TYPES, externalLink } from "./upgrade-core.js";
const $ = (id) => document.getElementById(id);
const schoolName = (id) =>
  PROJECT.schools.find((s) => s.id === id)?.school || id;
export function setupGallery({
  provider,
  subscribe,
  findFacility = () => null,
}) {
  const section = document.createElement("section");
  section.className = "card";
  section.id = "gallery";
  section.innerHTML = `<h2>기억의 좌표 갤러리</h2><p>우리가 발견한 장소, 우리가 전하는 기억. 선생님이 승인한 작품만 전시합니다.</p><div class="media-filter"><label>학교<select id="gallerySchool"><option value="ALL">전체 학교</option></select></label><label>현충시설<input id="galleryFacility" maxlength="100" placeholder="시설 이름으로 찾기"></label><label>유형<select id="galleryType"><option value="ALL">전체 유형</option></select></label></div><p id="galleryStatus" role="status"></p><div id="galleryItems" class="media-feed"></div><button id="galleryMore" class="gray" type="button">더 보기</button>`;
  document.querySelector(".wrap").append(section);
  for (const s of PROJECT.schools)
    $("gallerySchool").add(new Option(s.school, s.id));
  for (const type of MEDIA_TYPES) $("galleryType").add(new Option(type));
  let works = [],
    limit = 6,
    observer = null,
    detail = null;
  function closeDetail() {
    if (detail) {
      detail.querySelectorAll("video").forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      detail.close();
      detail.remove();
      detail = null;
    }
  }
  function imageCover(w, el) {
    if (
      !w.mediaPublicId ||
      !w.contentType?.startsWith("image/") ||
      !provider.enabled
    )
      return;
    const load = () => {
      try {
        const img = new Image();
        img.alt = w.title;
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = provider.publicUrl(w.mediaPublicId);
        img.onerror = () => {
          img.remove();
        };
        el.append(img);
        el.querySelector(".media-quote")?.remove();
      } catch {}
    };
    if ("IntersectionObserver" in window) {
      observer.observe(el);
      el._loadCover = load;
    } else load();
  }
  function show(w) {
    closeDetail();
    detail = document.createElement("dialog");
    detail.className = "media-detail";
    const close = document.createElement("button");
    close.textContent = "닫기";
    close.className = "media-close gray";
    close.onclick = closeDetail;
    const title = document.createElement("h2");
    title.textContent = w.title;
    const meta = document.createElement("p");
    meta.textContent = `${schoolName(w.schoolId)} · ${w.facilityName} · ${w.type}`;
    const text = document.createElement("pre");
    text.textContent = w.introduction;
    detail.append(close, title, meta, text);
    const location = findFacility(w.facilityName, w.schoolId);
    const place = document.createElement("p");
    place.textContent = location
      ? `위치: ${location.address || ""} · ${location.latitude}, ${location.longitude}`
      : "위치: 연결된 공개 탐구 기록이 아직 없어요. 아래 지도 찾기에서 확인해주세요.";
    detail.append(place);
    if (w.submissionMode === "external") {
      try {
        const a = document.createElement("a");
        a.href = externalLink(w.externalUrl);
        a.textContent = "승인된 외부 자료 열기";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        detail.append(a);
        const url = new URL(a.href),
          id =
            url.hostname === "youtu.be"
              ? url.pathname.slice(1)
              : url.hostname === "www.youtube.com"
                ? url.searchParams.get("v")
                : null,
          m =
            url.hostname === "drive.google.com" &&
            url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)/);
        const embed =
          id && /^[A-Za-z0-9_-]{11}$/.test(id)
            ? `https://www.youtube-nocookie.com/embed/${id}`
            : m
              ? `https://drive.google.com/file/d/${m[1]}/preview`
              : null;
        if (embed) {
          const button = document.createElement("button");
          button.textContent = "외부 미리보기 열기 (외부 서비스에 연결)";
          button.onclick = () => {
            const frame = document.createElement("iframe");
            frame.src = embed;
            frame.title = w.title;
            frame.loading = "lazy";
            frame.referrerPolicy = "no-referrer";
            frame.setAttribute(
              "sandbox",
              "allow-scripts allow-same-origin allow-presentation",
            );
            frame.style.cssText = "width:100%;height:360px;border:0";
            detail.append(frame);
            button.disabled = true;
          };
          detail.append(button);
        }
      } catch {}
    } else if (
      w.submissionMode === "upload" &&
      w.mediaPublicId &&
      provider.enabled
    ) {
      try {
        const url = provider.publicUrl(w.mediaPublicId),
          tag = w.contentType?.startsWith("image/")
            ? "img"
            : w.contentType?.startsWith("video/")
              ? "video"
              : "a",
          el = document.createElement(tag);
        if (tag === "a") {
          el.href = url;
          el.target = "_blank";
          el.rel = "noopener noreferrer";
          el.textContent = "승인된 PDF 열기";
        } else {
          el.src = url;
          if (tag === "video") {
            el.controls = true;
            el.preload = "metadata";
            el.playsInline = true;
          } else {
            el.alt = w.title;
            el.loading = "lazy";
          }
        }
        el.onerror = () => {
          el.remove();
          const p = document.createElement("p");
          p.textContent = "작품이 비공개로 바뀌었거나 지금 연결할 수 없어요.";
          detail?.append(p);
        };
        detail.append(el);
      } catch {}
    }
    const source = document.createElement("p");
    source.textContent =
      "출처: " + (w.sourceNote || "학생 제작 · 교사 검토 작품");
    detail.append(source);
    const map = document.createElement("button");
    map.textContent = "현충시설 위치 · 지도에서 찾기";
    map.onclick = () => {
      document.dispatchEvent(
        new CustomEvent("memory-gallery-map", {
          detail: { name: w.facilityName, schoolId: w.schoolId },
        }),
      );
      closeDetail();
    };
    detail.append(map);
    document.body.append(detail);
    detail.showModal();
    detail.addEventListener(
      "close",
      () => {
        if (detail && !detail.open) closeDetail();
      },
      { once: true },
    );
  }
  function render() {
    observer?.disconnect();
    closeDetail();
    $("galleryItems").replaceChildren();
    observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries)
                if (e.isIntersecting) {
                  e.target._loadCover?.();
                  observer.unobserve(e.target);
                }
            },
            { rootMargin: "100px" },
          )
        : null;
    const selected = works
      .filter(
        (w) =>
          w.status === "approved" &&
          ($("gallerySchool").value === "ALL" ||
            w.schoolId === $("gallerySchool").value) &&
          ($("galleryType").value === "ALL" ||
            w.type === $("galleryType").value) &&
          String(w.facilityName || "").includes(
            $("galleryFacility").value.trim(),
          ),
      )
      .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0));
    for (const w of selected.slice(0, limit)) {
      const card = document.createElement("article");
      card.className = "media-tile";
      const cover = document.createElement("div");
      cover.className = "media-cover";
      const quote = document.createElement("span");
      quote.className = "media-quote";
      quote.textContent = w.contentType?.startsWith("video/")
        ? "▶ " + w.title
        : w.type === "PDF"
          ? "PDF · " + w.title
          : w.introduction;
      cover.append(quote);
      const copy = document.createElement("div");
      copy.className = "tile-copy";
      const title = document.createElement("h3");
      title.textContent = w.title;
      const meta = document.createElement("p");
      meta.textContent = `${schoolName(w.schoolId)} · ${w.facilityName}`;
      const desc = document.createElement("p");
      desc.textContent = String(w.introduction || "").slice(0, 90);
      copy.append(title, meta, desc);
      const button = document.createElement("button");
      button.textContent = "승인 작품 보기";
      button.className = "gray";
      button.onclick = () => show(w);
      card.append(cover, copy, button);
      $("galleryItems").append(card);
      imageCover(w, cover);
    }
    $("galleryStatus").textContent = `승인 작품 ${selected.length}개 · 최신순`;
    $("galleryMore").hidden = selected.length <= limit;
  }
  for (const id of ["gallerySchool", "galleryFacility", "galleryType"])
    $(id).addEventListener("input", () => {
      limit = 6;
      render();
    });
  $("galleryMore").onclick = () => {
    limit += 6;
    render();
  };
  const unsubscribe = subscribe((value) => {
    works = Object.values(value || {});
    render();
  });
  document.addEventListener("memory-facility-selected", (e) => {
    $("galleryFacility").value = e.detail.name;
    $("gallerySchool").value = e.detail.schoolId;
    limit = 6;
    render();
    section.scrollIntoView({ behavior: "smooth" });
  });
  return () => {
    unsubscribe?.();
    observer?.disconnect();
    closeDetail();
    section.remove();
  };
}
