// Read a privately exported Rules JSON; only output expression hashes and changed paths.
// Never print teacher emails, tokens, student records, or write back to the source.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const [currentFile, draftFile] = process.argv.slice(2);
if (!currentFile || !draftFile)
  throw Error(
    "CURRENT.json DRAFT.json을 지정하세요. 운영 전체 Rules 파일은 저장소 밖에 두세요.",
  );
const current = JSON.parse(await readFile(currentFile, "utf8")),
  draft = JSON.parse(await readFile(draftFile, "utf8"));
const root = "memoryTemperature2026";
const hash = (x) =>
  createHash("sha256")
    .update(JSON.stringify(x ?? null))
    .digest("hex")
    .slice(0, 16);
for (const name of new Set([
  ...Object.keys(current.rules || {}),
  ...Object.keys(draft.rules || {}),
])) {
  if (name === root) continue;
  console.log(
    JSON.stringify({
      scope: "unrelated-root",
      path: name,
      status: "preserve-current",
      currentHash: hash(current.rules[name]),
      draftContains: Object.hasOwn(draft.rules, name),
    }),
  );
}
function compare(a, b, prefix) {
  if (hash(a) === hash(b)) return;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    console.log(
      JSON.stringify({
        path: prefix,
        currentHash: hash(a),
        candidateHash: hash(b),
        action: "manual-review",
      }),
    );
    return;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
    compare(
      a[key],
      b[key],
      `${prefix}/${key.startsWith(".") || key.startsWith("$") || ["submissions", "published", "works", "publishedWorks", "audit", "workAudit", "teachers"].includes(key) ? key : "<field-" + hash(key) + ">"}`,
    );
}
compare(current.rules?.[root], draft.rules?.[root], root);
console.log(
  "읽기 전용 비교 완료. 다른 루트·최상위 권한을 보존하여 검토용 병합본을 별도로 만들고, Emulator 통과 전 게시하지 마세요. 이메일 기반 승인과 claim 기반 승인은 별도 이행 계획이 필요합니다.",
);
