// Usage: node update-facility-cache.mjs RAW.json REVIEW.json OUTPUT.json
// Offline conversion only. Never guesses coordinate axes or fetches HTTP from a student browser.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { verifiedFacilities } from "../official-facilities.js";
export function buildCache(bytes, review) {
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (
    review.sourceSha256 !== sha ||
    review.crs !== "EPSG:4326" ||
    review.reviewed !== true ||
    !review.license ||
    !review.coordinateEvidence ||
    !review.responseEvidence ||
    !review.authenticationEvidence ||
    !review.corsEvidence ||
    !/^\d{4}-\d{2}-\d{2}$/.test(review.updatedAt || "")
  )
    throw Error(
      "원문 SHA256·응답/인증/CORS/이용 조건·좌표계 검토 기록이 필요합니다.",
    );
  const source = new URL(review.sourceUrl);
  if (
    source.protocol !== "https:" ||
    !["mfis.mpva.go.kr", "www.mpva.go.kr"].includes(source.hostname) ||
    source.username ||
    source.password ||
    source.port
  )
    throw Error("공식 HTTPS 출처만 사용합니다.");
  let rows = JSON.parse(bytes);
  for (const segment of review.recordsPath || []) rows = rows?.[segment];
  if (!Array.isArray(rows) || !rows.length)
    throw Error("명시한 응답 경로에 시설 배열이 없습니다.");
  const fields = review.fields || {};
  for (const k of ["id", "name", "address", "region", "latitude", "longitude"])
    if (
      typeof fields[k] !== "string" ||
      !fields[k] ||
      fields[k] === "__proto__"
    )
      throw Error("시설 필드와 위도·경도 축 매핑을 각각 명시하세요.");
  if (fields.latitude === fields.longitude)
    throw Error("위도·경도 필드는 달라야 합니다.");
  const facilities = rows.map((row) => ({
    id: String(row[fields.id] ?? ""),
    name: row[fields.name],
    address: row[fields.address],
    region: row[fields.region],
    latitude: Number(row[fields.latitude]),
    longitude: Number(row[fields.longitude]),
    sourceUrl: review.sourceUrl,
    verified: true,
  }));
  const cache = {
    schemaVersion: 1,
    status: "verified",
    sourceUrl: review.sourceUrl,
    sourceSha256: sha,
    updatedAt: review.updatedAt,
    crs: review.crs,
    coordinateMapping: `latitude=${fields.latitude};longitude=${fields.longitude}; ${review.coordinateEvidence}`,
    license: review.license,
    facilities,
  };
  if (
    verifiedFacilities(cache).length !== rows.length ||
    new Set(facilities.map((r) => r.id)).size !== rows.length
  )
    throw Error(
      "빈 필드·중복 ID·범위 밖 좌표·출처 오류가 있습니다. 일부 행만 통과시켜 게시하지 않습니다.",
    );
  if (
    !Array.isArray(review.spotChecks) ||
    review.spotChecks.length < Math.min(3, rows.length)
  )
    throw Error(
      "공식지도와 대조한 시설을 최소 3개(전체가 3개 미만이면 전체) 기록하세요.",
    );
  const checked = new Set();
  for (const point of review.spotChecks) {
    const r = facilities.find((r) => r.id === point.id);
    if (
      !r ||
      checked.has(point.id) ||
      !point.evidenceUrl?.startsWith("https://mfis.mpva.go.kr/") ||
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      Math.abs(r.latitude - point.latitude) > 0.001 ||
      Math.abs(r.longitude - point.longitude) > 0.001
    )
      throw Error(
        "알려진 시설 좌표 대조에 실패했습니다. 축 순서를 확인하세요.",
      );
    checked.add(point.id);
  }
  return cache;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [raw, review, out] = process.argv.slice(2);
  if (!raw || !review || !out)
    throw Error("RAW.json REVIEW.json OUTPUT.json을 지정하세요.");
  const cache = buildCache(
    await readFile(raw),
    JSON.parse(await readFile(review, "utf8")),
  );
  await writeFile(out, JSON.stringify(cache, null, 2) + "\n", { flag: "wx" });
  console.log(
    `검증된 시설 ${cache.facilities.length}건을 새 검토 파일에 저장했습니다. diff 검토 후에만 공식 캐시로 반영하세요.`,
  );
}
