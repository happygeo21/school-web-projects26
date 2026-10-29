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
      typeof r.address === "string" &&
      typeof r.region === "string" &&
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
  $("officialMapLink").parentElement.after(box);
  let cache = null;
  try {
    const res = await fetch("./official-facilities.json");
    if (!res.ok) throw Error();
    cache = await res.json();
  } catch {}
  const records = verifiedFacilities(cache);
  const render = () => {
    if (!canExplore()) return;
    const region = currentSchool().region;
    const q = $("facilityQuery").value.trim();
    const list = records
      .filter((r) => !q || `${r.name} ${r.address}`.includes(q))
      .sort(
        (a, b) => Number(b.region === region) - Number(a.region === region),
      );
    $("facilityResults").replaceChildren();
    $("facilityStatus").textContent = records.length
      ? `검증 캐시 · 갱신 ${cache.updatedAt} · 출처 국가보훈부`
      : "검증된 공식 목록을 아직 연결하지 못했어요. 공식지도 링크에서 확인하거나, 직접 제안 장소로 입력해주세요. 좌표와 공식 지정 여부는 따로 확인해요.";
    for (const r of list.slice(0, 50)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "place-result";
      b.textContent = `${r.name} · ${r.address}`;
      b.onclick = () => {
        if (!setPickedLocation(r.latitude, r.longitude, r.name)) return;
        $("placeName").value = r.name;
        $("placeName").dataset.facilityId = r.id;
        $("address").value = r.address;
        $("sourceNote").value =
          `국가보훈부 ${r.sourceUrl} (갱신 ${cache.updatedAt})`;
        $("sourceType").value = "국가보훈부·현충시설정보";
        $("officialStatus").value = "confirmed";
        $("placeOrigin").value = "official_map";
      };
      $("facilityResults").append(b);
    }
  };
  $("facilitySearch").onclick = render;
  $("school").addEventListener("change", () => {
    if ($("awarenessScore").disabled) render();
  });
  $("lockAwareness").addEventListener("click", () => {
    if ($("awarenessScore").disabled) render();
  });
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
