// No direct API adapter until response, CORS, license and coordinate mapping are verified.
export function verifiedFacilities(cache) {
  if (
    cache?.schemaVersion !== 1 ||
    cache.status !== "verified" ||
    cache.crs !== "EPSG:4326" ||
    !cache.coordinateMapping ||
    !cache.license ||
    !/^\d{4}-\d{2}-\d{2}$/.test(cache.updatedAt || "")
  )
    return [];
  return (cache.facilities || []).filter(
    (r) =>
      r.verified === true &&
      /^[A-Za-z0-9_-]+$/.test(r.id) &&
      typeof r.name === "string" &&
      r.name.trim().length > 0 &&
      r.name.length <= 100 &&
      typeof r.address === "string" &&
      r.address.trim().length > 0 &&
      r.address.length <= 160 &&
      typeof r.region === "string" &&
      r.region.trim().length > 0 &&
      Number.isFinite(r.latitude) &&
      Number.isFinite(r.longitude) &&
      r.latitude >= 33 &&
      r.latitude <= 39.5 &&
      r.longitude >= 124 &&
      r.longitude <= 132 &&
      /^https:\/\/(mfis\.mpva|www\.mpva)\.go\.kr\//.test(r.sourceUrl),
  );
}
export async function setupFacilities({
  canExplore,
  currentSchool,
  setPickedLocation,
  clearLocation,
}) {
  const $ = (id) => document.getElementById(id),
    box = document.createElement("section");
  box.className = "official-box";
  box.innerHTML =
    '<h3>우리 지역 공식 시설 찾기</h3><p>사전 응답을 확정한 뒤 목록을 살펴보세요. 일반 지도 검색 결과는 공식 지정 근거가 아니에요.</p><label for="facilityQuery">시설 이름·주소</label><input id="facilityQuery" maxlength="100"><button type="button" id="facilitySearch" class="primary">공식 목록 검색</button><p id="facilityStatus" role="status"></p><div id="facilityResults"></div>';
  const sourceLink = document.createElement('a');
  sourceLink.href = 'https://www.mpva.go.kr/mpva/contents.do?key=17';
  sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer';
  sourceLink.textContent = '공식 자료 출처·제공 안내';
  box.append(sourceLink);
  $("officialMapLink").parentElement.after(box);
  let cache = null;
  try {
    const res = await fetch("./official-facilities.json");
    if (!res.ok) throw Error();
    cache = await res.json();
  } catch {}
  const records = verifiedFacilities(cache);
  const render = () => {
    if (!$("awarenessScore").disabled) return;
    const region = currentSchool().region;
    const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g,' ').trim();
    const q = normalize($("facilityQuery").value);
    const list = records
      .filter((r) => !q || normalize(`${r.name} ${r.address}`).includes(q))
      .sort(
        (a, b) => Number(`${b.region} ${b.address}`.includes(region)) - Number(`${a.region} ${a.address}`.includes(region)),
      );
    $("facilityResults").replaceChildren();
    $("facilityStatus").textContent = records.length
      ? `검증 캐시 · 갱신 ${cache.updatedAt} · 출처 국가보훈부 · 검색 ${list.length}개${list.length ? '' : ' · 공식지도에서 확인하거나 직접 위치를 선택해주세요.'}`
      : "검증된 공식 목록을 아직 연결하지 못했어요. 공식지도 링크에서 확인하거나, 직접 제안 장소로 입력해주세요. 좌표와 공식 지정 여부는 따로 확인해요.";
    for (const r of list.slice(0, 50)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "place-result";
      b.textContent = `${r.name} · ${r.address}`;
      b.onclick = () => {
        if (!setPickedLocation(r.latitude, r.longitude, r.name)) return;
        $("placeName").value = r.name;
        $("placeSearchQuery").value = r.name;
        $("placeName").dataset.facilityId = r.id;
        $("address").value = r.address;
        $("sourceNote").value =
          `국가보훈부 ${r.sourceUrl} (갱신 ${cache.updatedAt})`;
        $("sourceType").value = "국가보훈부·현충시설정보";
        $("officialStatus").value = "confirmed";
        $("placeOrigin").value = "official_map";
        document.dispatchEvent(new CustomEvent('memory-work-facility', {detail:{name:r.name}}));
        document.dispatchEvent(new Event("memory-draft-change"));
      };
      $("facilityResults").append(b);
    }
  };
  $("facilityQuery").setAttribute("aria-controls", "facilityResults");
  $("facilityQuery").setAttribute("autocomplete", "off");
  $("facilityQuery").addEventListener("input", render);
  $("facilityQuery").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      $("facilityResults").querySelector("button")?.focus();
      e.preventDefault();
    }
  });
  $("facilitySearch").onclick = () => {
    if (canExplore()) render();
  };
  $("school").addEventListener("change", () => {
    if ($("awarenessScore").disabled) render();
  });
  $("lockAwareness").addEventListener("click", () => {
    if ($("awarenessScore").disabled) render();
  });
  if ($("awarenessScore").disabled) render();
  const invalidate = () => {
    delete $("placeName").dataset.facilityId;
    if ($("placeOrigin").value === "official_map") {
      $("officialStatus").value = "not_checked";
    }
  };
  $("placeName").addEventListener("input", invalidate);
  $("address").addEventListener("input", invalidate);
  $("placeOrigin").addEventListener("change", () => {
    invalidate();
    clearLocation();
  });
}
