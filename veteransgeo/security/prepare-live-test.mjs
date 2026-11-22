import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLiveConfig, privatePath, checkout } from "./live-config.mjs";
import { digestBytes } from "../media-policy.js";
export async function prepareLiveTest(configFile, out) {
  const { config: c, targets } = await readLiveConfig(configFile),
    target = await privatePath(out, { existing: false });
  try {
    await stat(target);
    throw Error(
      "기존 test-web/후보를 덮어쓰지 않습니다. 새 출력 폴더를 지정하세요.",
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await mkdir(target, { mode: 0o700 });
  const web = path.join(target, "test-web");
  await mkdir(web, { mode: 0o700 });
  const files = JSON.parse(
    await readFile(path.join(checkout, "scripts/public-files.json"), "utf8"),
  )
    .files.filter((p) => p.startsWith("veteransgeo/"))
    .map((p) => p.slice(12));
  for (const file of files) {
    if (file === "firebase-config.js" || file === "media-config.js") continue;
    const src = path.join(checkout, "veteransgeo", file);
    if (
      /\.(js|html|json|mjs)$/.test(file) &&
      (await readFile(src, "utf8")).includes("school-project-26-1edf4")
    )
      throw Error(
        "테스트 복사본에 운영 대상 상수가 남아 있어 준비를 중단했습니다.",
      );
    const dest = path.join(web, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(src, dest);
  }
  const f = Object.fromEntries(
    [
      "apiKey",
      "authDomain",
      "projectId",
      "databaseURL",
      "appId",
      "messagingSenderId",
    ]
      .filter((k) => c.firebase[k] !== undefined)
      .map((k) => [k, c.firebase[k]]),
  );
  await writeFile(
    path.join(web, "rehearsal-target.mjs"),
    await readFile(new URL("../server/rehearsal-target.mjs", import.meta.url)),
    { mode: 0o600 },
  );
  const guard = `import {rehearsalTargets,assertReadiness,assertAuthProject} from './rehearsal-target.mjs';\nconst firebase=${JSON.stringify(f)}, endpoint=${JSON.stringify(c.mediaEndpoint)}, expected=${JSON.stringify(targets)};\ntry {\n const local=rehearsalTargets({projectId:firebase.projectId,databaseURL:firebase.databaseURL,supabaseURL:'https://'+expected.supabaseHost});assertReadiness(expected,local);\n if(location.origin!==${JSON.stringify(c.webOrigin)})throw Error();\n const r=await fetch(endpoint+'?action=readiness',{cache:'no-store'});if(!r.ok)throw Error();assertReadiness(expected,await r.json());\n const a=await fetch('https://identitytoolkit.googleapis.com/v1/projects?key='+encodeURIComponent(firebase.apiKey),{cache:'no-store'});if(!a.ok)throw Error();assertAuthProject(expected,${JSON.stringify(c.projectNumber)},await a.json());\n} catch { const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='테스트 연결 확인 실패: 로그인·저장을 시작하지 않았습니다. 테스트 프로젝트와 서버 설정을 확인하세요.';document.body.prepend(p);throw Error('테스트 연결 중단');}\nexport const verified=true;\n`;
  await writeFile(path.join(web, "rehearsal-guard.js"), guard, { mode: 0o600 });
  await writeFile(
    path.join(web, "firebase-config.js"),
    `import './rehearsal-guard.js';\nexport const firebaseConfig=${JSON.stringify(f)};\nexport const DB_ROOT='memoryTemperature2026';\n`,
    { mode: 0o600 },
  );
  await writeFile(
    path.join(web, "media-config.js"),
    `import './rehearsal-guard.js';\nexport const MEDIA_CONFIG=Object.freeze({enabled:true,endpoint:${JSON.stringify(c.mediaEndpoint)}});\n`,
    { mode: 0o600 },
  );
  const rules = JSON.parse(
      await readFile(new URL("./database.rules.json", import.meta.url), "utf8"),
    ),
    claim = rules.rules.memoryTemperature2026.submissions[".read"];
  const teacher = `auth != null && auth.uid == ${JSON.stringify(c.teachers.approved.uid)} && auth.token.email == ${JSON.stringify(c.teachers.approved.email)}`;
  const replace = (v) =>
    typeof v === "string"
      ? v.split(claim).join("(" + teacher + ")")
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x)]))
        : v;
  await writeFile(
    path.join(target, "test-only.rules.json"),
    JSON.stringify(replace(rules), null, 2) + "\n",
    { mode: 0o600, flag: "wx" },
  );
  const hashes = Object.fromEntries(
    await Promise.all(
      Object.entries(c.activityCodes).map(async ([school, code]) => [
        school,
        await digestBytes(new TextEncoder().encode(code)),
      ]),
    ),
  );
  const secrets = {
    FIREBASE_PROJECT_ID: c.firebase.projectId,
    FIREBASE_DATABASE_URL: c.firebase.databaseURL,
    APPROVED_TEACHER_UIDS: JSON.stringify([c.teachers.approved.uid]),
    SCHOOL_ACTIVITY_HASHES: JSON.stringify(hashes),
    ALLOWED_ORIGINS: JSON.stringify([c.webOrigin]),
  };
  await writeFile(
    path.join(target, "server-secrets.env"),
    Object.entries(secrets)
      .map(([k, v]) => k + "=" + v)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  await writeFile(
    path.join(target, "targets.json"),
    JSON.stringify(
      {
        targets,
        webOrigin: c.webOrigin,
        purpose: c.purpose,
        plans: "user-attested; verify in consoles",
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  return {
    target,
    web,
    files: files.length + 2,
    networkHosts: [
      targets.databaseHost,
      targets.supabaseHost,
      "identitytoolkit.googleapis.com",
      "securetoken.googleapis.com",
      "www.gstatic.com",
    ],
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2),
      file = args[args.indexOf("--config") + 1],
      out = args[args.indexOf("--out") + 1];
    if (!args.includes("--config") || !args.includes("--out"))
      throw Error("--config PRIVATE.json --out NEW_PRIVATE_DIR를 지정하세요.");
    const r = await prepareLiveTest(file, out);
    console.log(
      JSON.stringify({ status: "prepared-not-connected", ...r }, null, 2),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
