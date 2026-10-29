// Read-only public-source diagnostics. No credentials, raw payload, or cache publication.
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
const exec = promisify(execFile);
const targets = [
  ["api", "https://mfis.mpva.go.kr/api/json/allSearch.do"],
  ["guide", "https://www.mpva.go.kr/mpva/contents.do?key=17"],
];
const results = [];
for (const [kind, url] of targets) {
  const result = {
    kind,
    url,
    checkedAt: new Date().toISOString(),
    verifiedCache: false,
  };
  try {
    const dir = await mkdtemp(path.join(tmpdir(), "veterans-official-probe-"));
    let raw;
    try {
      const headersFile = path.join(dir, "headers"),
        bodyFile = path.join(dir, "response");
      const { stdout } = await exec("curl", [
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--max-time",
        "20",
        "--max-filesize",
        "12582912",
        "--silent",
        "--show-error",
        "-D",
        headersFile,
        "-o",
        bodyFile,
        "--write-out",
        "%{http_code}",
        "--header",
        "Origin: https://happygeo21.github.io",
        url,
      ]);
      result.status = Number(stdout);
      const headers = await readFile(headersFile, "utf8");
      const header = (name) =>
        [...headers.matchAll(new RegExp("^" + name + ":\\s*(.*)$", "gim"))]
          .at(-1)?.[1]
          ?.trim() || null;
      result.contentType = header("content-type");
      result.allowOrigin = header("access-control-allow-origin");
      raw = await readFile(bodyFile);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    result.bytes = raw.length;
    result.sha256 = createHash("sha256").update(raw).digest("hex");
    if (kind === "api" && result.status >= 200 && result.status < 300) {
      try {
        const json = JSON.parse(raw.toString("utf8"));
        result.jsonParsed = true;
        result.topLevel = Array.isArray(json) ? "array" : typeof json;
        result.rootFields =
          json && typeof json === "object" && !Array.isArray(json)
            ? Object.keys(json)
                .filter((k) => /^[A-Za-z0-9_]+$/.test(k))
                .slice(0, 30)
            : [];
        const arrays = [];
        function scan(value, path = [], depth = 0) {
          if (depth > 4 || arrays.length >= 8) return;
          if (Array.isArray(value)) {
            arrays.push({
              path,
              records: value.length,
              firstItemFields:
                value[0] && typeof value[0] === "object"
                  ? Object.keys(value[0])
                      .filter((k) => /^[A-Za-z0-9_]+$/.test(k))
                      .slice(0, 50)
                  : [],
            });
            return;
          }
          if (value && typeof value === "object")
            for (const [k, v] of Object.entries(value))
              if (/^[A-Za-z0-9_]+$/.test(k)) scan(v, [...path, k], depth + 1);
        }
        scan(json);
        result.arrays = arrays;
      } catch {
        result.jsonParsed = false;
      }
    }
  } catch (e) {
    result.error =
      e.name === "TimeoutError"
        ? "timeout"
        : String(e.message).includes("redirect")
          ? "redirect-refused"
          : "request-failed";
  }
  results.push(result);
}
const report = JSON.stringify(
  {
    note: "Public source probe only; HTTP 200/JSON does not verify CRS, axis order, license or authentication conditions. No facilities are published.",
    results,
  },
  null,
  2,
);
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    "## Official source probe (read-only)\n\n```json\n" + report + "\n```\n",
  );
