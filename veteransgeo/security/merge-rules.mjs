// Offline review artifact only. Never publish, read production, or overwrite existing files.
import { readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const [currentFile, candidateFile, out, mode = "existing"] =
  process.argv.slice(2);
if (
  !currentFile ||
  !candidateFile ||
  !out ||
  !["existing", "claims"].includes(mode)
)
  throw Error("CURRENT.json CANDIDATE.json OUTPUT.json [existing|claims]");
const checkout = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const target = path.join(
  await realpath(path.dirname(path.resolve(out))),
  path.basename(out),
);
const source = await realpath(currentFile);
if (source === checkout || source.startsWith(checkout + path.sep))
  throw Error("운영 Rules 원본은 저장소 밖에서만 읽습니다.");
if (target === checkout || target.startsWith(checkout + path.sep))
  throw Error("운영 교사 목록이 포함될 수 있으므로 출력은 저장소 밖에 두세요.");
async function readRules(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw Error(
      "Rules 파일을 읽거나 JSON으로 해석하지 못했습니다. 원문 내용은 출력하지 않습니다.",
    );
  }
}
const current = await readRules(currentFile),
  candidate = await readRules(candidateFile),
  name = "memoryTemperature2026";
if (!current.rules?.[name] || !candidate.rules?.[name])
  throw Error("명시한 프로젝트 루트가 없습니다.");
let subtree = structuredClone(candidate.rules[name]);
if (mode === "existing") {
  const approved = current.rules[name].submissions?.[".read"],
    claim = subtree.submissions[".read"];
  if (
    typeof approved !== "string" ||
    !approved.includes("auth.token.email") ||
    /\btrue\b/.test(approved)
  )
    throw Error(
      "기존 교사 이메일 승인 표현식을 확인하지 못했습니다. 사람이 먼저 검토해야 합니다.",
    );
  const replace = (value) =>
    typeof value === "string"
      ? value.split(claim).join("(" + approved + ")")
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, replace(v)]),
          )
        : value;
  subtree = replace(subtree);
}
// Preserve every unrelated root and global rule verbatim; new subtree needs manual diff review.
const merged = structuredClone(current);
merged.rules[name] = { ...current.rules[name], ...subtree };
await writeFile(target, JSON.stringify(merged, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
console.log(
  "저장소 밖에 권한 0600의 검토용 병합본을 생성했습니다. 다른 루트/최상위 권한은 보존했습니다. 게시하지 않았습니다.",
);
