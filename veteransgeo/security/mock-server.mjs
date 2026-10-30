// LOCAL MOCK ONLY. No Firebase/Supabase network calls. Not a deployable production server.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createGateway } from "../server/gateway.mjs";
import { digestBytes } from "../media-policy.js";
import { createMockMedia } from "./mock-media.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function createMockServer() {
  const env = createMockMedia(),
    tree = {
      memoryTemperature2026: {
        submissions: {},
        published: {},
        works: {},
        publishedWorks: {},
        workAudit: {},
      },
    };
  let origin;
  const lookup = (p) =>
    p
      .split("/")
      .filter(Boolean)
      .reduce((o, k) => o?.[k], tree) ?? null;
  const resolveTimestamp = value => value && typeof value === "object"
    ? (Object.keys(value).length === 1 && value[".sv"] === "timestamp" ? Date.now()
      : Array.isArray(value) ? value.map(resolveTimestamp)
      : Object.fromEntries(Object.entries(value).map(([k,v]) => [k,resolveTimestamp(v)]))) : value;
  const write = (p, v) => {
    // Model Firebase server timestamps in fixtures; this is still a local mock.
    v = resolveTimestamp(v);
    const parts = p.split("/").filter(Boolean);
    let node = tree;
    for (const k of parts.slice(0, -1)) node = node[k] ??= {};
    if (v === null) delete node[parts.at(-1)];
    else node[parts.at(-1)] = v;
  };
  const hash = await digestBytes(new TextEncoder().encode("TEST"));
  const gateway = createGateway({
    ...env,
    db: {
      work: async (p) => {
        if (env.state.failDB) throw Error("offline");
        return lookup(
          `memoryTemperature2026/works/${p.schoolId}/${p.ownerUid}/${p.workId}`,
        );
      },
      published: async (id) =>
        lookup("memoryTemperature2026/publishedWorks/" + id),
    },
    teachers: ["mock-teacher"],
    schoolActivityHashes: Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => ["S" + (i + 1), hash]),
    ),
    origins: [],
    verify: async (t) => {
      if (!["mock-student", "mock-teacher", "mock-other"].includes(t))
        throw Error("auth");
      return {
        sub: t,
        firebase: {
          sign_in_provider: t === "mock-teacher" ? "password" : "anonymous",
        },
      };
    },
  });
  const manifest = JSON.parse(
    await readFile(
      new URL("../../scripts/public-files.json", import.meta.url),
      "utf8",
    ),
  )
    .files.filter((p) => p.startsWith("veteransgeo/"))
    .map((p) => p.slice(12));
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin),
        file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      if (url.pathname === "/__mock/media") {
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers))
          if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
        // Same-origin local mock needs no browser CORS gate; the production gateway retains exact origins.
        headers.delete("origin");
        const bytes = [];
        for await (const c of req) bytes.push(c);
        const request = new Request(url, {
            method: req.method,
            headers,
            ...(req.method === "POST" ? { body: Buffer.concat(bytes) } : {}),
          }),
          r = await gateway(request);
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      if (url.pathname === "/__mock/db") {
        const body =
          req.method === "POST"
            ? JSON.parse(
                await new Promise((resolve) => {
                  let b = "";
                  req.on("data", (c) => (b += c));
                  req.on("end", () => resolve(b));
                }),
              )
            : null;
        const p = body?.path || url.searchParams.get("path") || "",
          token = req.headers.authorization?.replace("Bearer ", "");
        const teacher = token === "mock-teacher",
          student = token === "mock-student";
        const allowed =
          teacher ||
          (p.startsWith("memoryTemperature2026/published") &&
            req.method === "GET") ||
          (student &&
            /^memoryTemperature2026\/(works|submissions)\/S[1-7]\/mock-student(?:\/|$)/.test(
              p,
            ));
        if (!allowed || (body && env.state.denyNext)) {
          env.state.denyNext = false;
          res.writeHead(403).end("{}");
          return;
        }
        if (body) {
          if (body.method === "update") {
            for (const [k, v] of Object.entries(body.data))
              write([p, k].filter(Boolean).join("/"), v);
          } else write(p, body.data);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body ? { ok: true } : lookup(p)));
        return;
      }
      if (file === "__mock/firebase.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(await readFile(new URL("./mock-firebase.js", import.meta.url)));
        return;
      }
      if (!manifest.includes(file)) {
        res.writeHead(404).end();
        return;
      }
      let content = await readFile(path.join(root, file));
      if (file === "firebase-config.js")
        content = Buffer.from(
          `export const firebaseConfig={projectId:'demo-veteransgeo',databaseURL:'http://127.0.0.1',apiKey:'local-mock-only'};export const DB_ROOT='memoryTemperature2026';`,
        );
      else if (file === "media-config.js")
        content = Buffer.from(
          `export const MEDIA_CONFIG={enabled:true,endpoint:${JSON.stringify(origin + "/__mock/media")}};`,
        );
      else if (/\.(html|js)$/.test(file)) {
        let text = content
          .toString()
          .replace(
            /https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-[a-z-]+\.js/g,
            "/__mock/firebase.js",
          );
        if (file.endsWith(".html"))
          text = text.replace(
            "<body>",
            '<body><div role="note" style="padding:12px;background:#ffe59a">로컬 Mock 실습 · 가상 계정과 메모리 저장소만 사용 · 실제 Firebase/Supabase 아님 · 활동코드 TEST</div>',
          );
        content = Buffer.from(text);
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".json")
              ? "application/json"
              : "text/html",
      );
      res.end(content);
    } catch {
      res.writeHead(500).end("Local mock error");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  return { server, origin, state: env.state, tree, lookup, write };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { origin } = await createMockServer();
  console.log(
    "LOCAL MOCK ONLY: " +
      origin +
      " · teacher.html · public.html · activity TEST",
  );
}
