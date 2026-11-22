// Only serves the generated test-web allowlist on loopback; never its parent containing secrets/Rules.
import http from "node:http";
import { readFile, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privatePath, checkout } from "./live-config.mjs";
import {
  rehearsalTargets,
  assertReadiness,
} from "../server/rehearsal-target.mjs";
export async function privateTestServer(prepared) {
  const root = await privatePath(prepared),
    receipt = JSON.parse(
      await readFile(path.join(root, "targets.json"), "utf8"),
    ),
    web = await realpath(path.join(root, "test-web"));
  if (web !== path.join(root, "test-web"))
    throw Error("test-web 심볼릭 링크를 사용하지 않습니다.");
  const t = receipt.targets;
  assertReadiness(
    rehearsalTargets({
      projectId: t.firebaseProjectId,
      databaseURL: "https://" + t.databaseHost,
      supabaseURL: "https://" + t.supabaseHost,
    }),
    t,
  );
  const origin = new URL(receipt.webOrigin);
  if (
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(receipt.webOrigin) ||
    origin.origin !== receipt.webOrigin
  )
    throw Error("명시된 localhost 주소만 제공합니다.");
  const files = JSON.parse(
      await readFile(path.join(checkout, "scripts/public-files.json"), "utf8"),
    )
      .files.filter((p) => p.startsWith("veteransgeo/"))
      .map((p) => p.slice(12)),
    allowed = new Set([...files, "rehearsal-guard.js", "rehearsal-target.mjs"]);
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (
      !["GET", "HEAD"].includes(req.method) ||
      req.headers.host !== origin.host ||
      (req.headers.origin && req.headers.origin !== origin.origin)
    ) {
      res.writeHead(403).end();
      return;
    }
    try {
      const url = new URL(req.url, origin),
        file =
          url.pathname === "/"
            ? "index.html"
            : decodeURIComponent(url.pathname.slice(1));
      if (!allowed.has(file)) {
        res.writeHead(404).end();
        return;
      }
      let p = web;
      for (const part of file.split("/")) {
        p = path.join(p, part);
        if ((await lstat(p)).isSymbolicLink()) throw Error("symlink");
      }
      res.setHeader(
        "Content-Type",
        /\.(js|mjs)$/.test(file)
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".json")
              ? "application/json"
              : file.endsWith(".md")
                ? "text/plain"
                : "text/html",
      );
      const content = await readFile(p);
      res.writeHead(200);
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(404).end();
    }
  });
  return { server, origin: origin.origin, port: Number(origin.port) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (!args.includes("--prepared"))
      throw Error("--prepared NEW_PRIVATE_DIR를 지정하세요.");
    const r = await privateTestServer(args[args.indexOf("--prepared") + 1]);
    r.server.on("error", () => {
      console.error(
        "localhost 테스트 서버를 열지 못했습니다. 포트/설정을 확인하세요.",
      );
      process.exitCode = 2;
    });
    r.server.listen(r.port, "127.0.0.1", () =>
      console.log(
        "비공개 테스트 웹만 제공: " + r.origin + " · 운영/Netlify 아님",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
