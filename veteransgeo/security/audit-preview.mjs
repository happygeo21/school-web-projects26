// Static Deploy Preview + public Auth configuration inspection only.
// Never request RTDB/Storage/student records, sign in, or issue a mutating request.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const exec = promisify(execFile),
  production = "school-project-26-1edf4";
async function get(url, origin) {
  const dir = await mkdtemp(path.join(tmpdir(), "preview-audit-"));
  try {
    const config = path.join(dir, "request"),
      body = path.join(dir, "body");
    await writeFile(config, `url = ${JSON.stringify(url)}\n`, { mode: 0o600 });
    const args = [
      "--config",
      config,
      "--proto",
      "=https",
      "--proto-redir",
      "=https",
      "--max-time",
      "15",
      "--max-filesize",
      "2097152",
      "--silent",
      "--show-error",
      "-o",
      body,
      "--write-out",
      "%{http_code}",
    ];
    if (origin) args.push("--referer", origin);
    const { stdout } = await exec("curl", args);
    return { status: Number(stdout), body: await readFile(body, "utf8") };
  } catch {
    return { status: null, body: "" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const safeProject = (value) =>
  /^[a-z0-9-]+$/.test(value || "") ? value : null;
const reports = [];
for (const site of ["veteransgeo", "happygeo"]) {
  const origin = `https://deploy-preview-7--${site}.netlify.app`,
    report = {
      site,
      origin,
      method: "static GET only",
      noDatabaseOrStorageRequests: true,
    };
  const [home, rootConfig, nestedConfig, ...privateFiles] = await Promise.all([
    get(origin + "/"),
    get(origin + "/firebase-config.js"),
    get(origin + "/" + site + "/firebase-config.js"),
    ...[
      "/security/REVIEW.md",
      "/security/database.rules.json",
      "/veteransgeo/security/REVIEW.md",
      "/veteransgeo/security/database.rules.json",
    ].map((p) => get(origin + p)),
  ]);
  report.homeStatus = home.status;
  report.title =
    (home.body.match(/<title>([^<]{0,160})<\/title>/i) || [])[1] || null;
  const config =
    rootConfig.status === 200 && /projectId\s*:/.test(rootConfig.body)
      ? rootConfig
      : nestedConfig;
  report.configStatus = config.status;
  const project = (config.body.match(/projectId\s*:\s*["']([^"']+)["']/) ||
    [])[1];
  const db = (config.body.match(/databaseURL\s*:\s*["']([^"']+)["']/) || [])[1];
  const apiKey = (config.body.match(/apiKey\s*:\s*["']([^"']+)["']/) || [])[1];
  report.projectId = safeProject(project);
  try {
    report.databaseHost = new URL(db).hostname;
  } catch {
    report.databaseHost = null;
  }
  report.productionProject = project === production;
  report.productionDatabase = !!report.databaseHost?.startsWith(
    production + "-default-rtdb.",
  );
  report.privateFiles = [
    "/security/REVIEW.md",
    "/security/database.rules.json",
    "/veteransgeo/security/REVIEW.md",
    "/veteransgeo/security/database.rules.json",
  ].map((p, i) => ({
    path: p,
    status: privateFiles[i].status,
    expected404: privateFiles[i].status === 404,
  }));
  if (apiKey) {
    const response = await get(
      "https://identitytoolkit.googleapis.com/v1/projects?key=" +
        encodeURIComponent(apiKey),
      origin + "/",
    );
    report.authConfigStatus = response.status;
    try {
      const domains = JSON.parse(response.body).authorizedDomains;
      if (Array.isArray(domains)) {
        report.authDomainExactMatch = domains.includes(
          new URL(origin).hostname,
        );
        report.githubPagesExactMatch = domains.includes("happygeo21.github.io");
        report.netlifyProductionExactMatch = domains.includes(
          site + ".netlify.app",
        );
      } else report.authDomainExactMatch = null;
    } catch {
      report.authDomainExactMatch = null;
    }
  }
  const risk =
    report.productionProject || report.productionDatabase
      ? "PRODUCTION BACKEND — do not submit/edit/delete in preview"
      : "backend not confirmed as production; Console review still required";
  console.log(
    `::warning title=Preview ${site}::${risk}; project=${report.projectId || "unreadable"}; dbHost=${report.databaseHost || "unreadable"}; homeHTTP=${report.homeStatus}; authConfigHTTP=${report.authConfigStatus || "unavailable"}; previewDomainExact=${report.authDomainExactMatch ?? "unknown"}; privatePaths404=${report.privateFiles.every((x) => x.expected404)}`,
  );
  reports.push(report);
}
const result = JSON.stringify(
  {
    checkedAt: new Date().toISOString(),
    reports,
    note: "No student reads/writes. authDomainExactMatch is an exact-list test, not a complete OAuth sign-in test. Unknown/failed GET is not a safety pass. No API keys/tokens are included.",
  },
  null,
  2,
);
console.log(result);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    "## PR #7 preview safety (read-only)\n\n```json\n" + result + "\n```\n",
  );
