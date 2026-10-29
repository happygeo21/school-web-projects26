import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  stat,
  chmod,
  symlink,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createReadStream } from "node:fs";
import https from "node:https";
import { execFileSync } from "node:child_process";
import http from "node:http";
import { createRequire } from "node:module";
import {
  rehearsalTargets,
  assertReadiness,
  assertAuthProject,
} from "../server/rehearsal-target.mjs";
import { createGateway } from "../server/gateway.mjs";
import { validateLiveConfig, privatePath, checkout } from "./live-config.mjs";
import { prepareLiveTest } from "./prepare-live-test.mjs";
import { createLiveHTTP } from "./live-http.mjs";
import { runLiveTest } from "./live-test.mjs";
const config = () => ({
  purpose: "veteransgeo-test-only",
  firebasePlan: "Spark",
  supabasePlan: "Free",
  syntheticDataOnly: true,
  projectNumber: "12345",
  firebase: {
    projectId: "veterans-rehearsal",
    apiKey: "synthetic-web-key-not-a-real-key",
    authDomain: "veterans-rehearsal.firebaseapp.com",
    appId: "1:12345:web:abcdef",
    databaseURL:
      "https://veterans-rehearsal-default-rtdb.asia-southeast1.firebasedatabase.app",
  },
  supabaseURL: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
  mediaEndpoint: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/media",
  webOrigin: "http://127.0.0.1:8765",
  teachers: {
    approved: {
      uid: "synthetic-approved",
      email: "approved@example.invalid",
      password: "PRIVATE_FAKE_PASSWORD",
    },
    unapproved: {
      uid: "synthetic-unapproved",
      email: "unapproved@example.invalid",
      password: "PRIVATE_FAKE_OTHER",
    },
  },
  activityCodes: Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => ["S" + (i + 1), "PRIVATE_FAKE_CODE"]),
  ),
});
test("test-only targets reject production, mismatched Firebase instances, credentials, custom endpoints and plan ambiguity", () => {
  const c = config(),
    valid = validateLiveConfig(c);
  assert.equal(valid.targets.firebaseProjectId, c.firebase.projectId);
  for (const change of [
    (x) => (x.firebase.projectId = "school-project-26-1edf4"),
    (x) =>
      (x.firebase.databaseURL =
        "https://school-project-26-1edf4-default-rtdb.asia-southeast1.firebasedatabase.app"),
    (x) =>
      (x.firebase.databaseURL = "https://other-default-rtdb.firebaseio.com"),
    (x) => (x.supabaseURL = "https://evil.invalid"),
    (x) => (x.mediaEndpoint += "?fallback=prod"),
    (x) => (x.firebasePlan = "Blaze"),
    (x) => (x.supabasePlan = "Pro"),
    (x) => (x.syntheticDataOnly = false),
    (x) => (x.projectNumber = "999"),
    (x) => (x.serviceRoleKey = "MUST_NOT_APPEAR"),
    (x) => (x.webOrigin = "https://deploy-preview-7--veteransgeo.netlify.app"),
  ]) {
    const d = config();
    change(d);
    assert.throws(() => validateLiveConfig(d));
  }
  assert.throws(() =>
    assertReadiness(valid.targets, {
      ...valid.targets,
      databaseHost: "other.firebaseio.com",
    }),
  );
  for (const id of [c.projectNumber, c.firebase.projectId])
    assert.equal(
      assertAuthProject(valid.targets, c.projectNumber, {
        projectId: id,
        authorizedDomains: [c.firebase.authDomain],
      }),
      true,
    );
  assert.throws(() =>
    assertAuthProject(valid.targets, c.projectNumber, {
      projectId: "999",
      authorizedDomains: [c.firebase.authDomain],
    }),
  );
  assert.throws(() =>
    assertAuthProject(valid.targets, c.projectNumber, {
      projectId: c.projectNumber,
      authorizedDomains: ["school-project-26-1edf4.firebaseapp.com"],
    }),
  );
});
test("readiness exposes only safe target identifiers and never calls Auth, DB or Storage", async () => {
  const targets = validateLiveConfig(config()).targets;
  let calls = 0;
  const gateway = createGateway({
    deployment: {
      ...targets,
      serviceKey: "DO_NOT_EXPOSE",
      teachers: ["DO_NOT_EXPOSE"],
    },
    origins: [],
    teachers: [],
    verify: () => {
      calls++;
    },
    db: new Proxy(
      {},
      {
        get() {
          calls++;
        },
      },
    ),
    ledger: {},
    blobs: {},
    schoolActivityHashes: {},
  });
  const r = await gateway(
    new Request("https://edge.invalid/media?action=readiness"),
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), targets);
  assert.equal(calls, 0);
});
test("private preparation preserves repository configs, excludes passwords/codes and refuses symlink/overwrite paths", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rehearsal-private-"));
  try {
    const f = path.join(dir, "input.json"),
      out = path.join(dir, "prepared"),
      before = await readFile(
        path.join(checkout, "veteransgeo/firebase-config.js"),
      );
    await writeFile(f, JSON.stringify(config()), { mode: 0o600 });
    const r = await prepareLiveTest(f, out);
    assert.deepEqual(
      await readFile(path.join(checkout, "veteransgeo/firebase-config.js")),
      before,
    );
    let publicText = "";
    for (const name of await readdir(r.web))
      if (/\.(js|json|mjs|html)$/.test(name))
        publicText += await readFile(path.join(r.web, name), "utf8");
    for (const secret of [
      "PRIVATE_FAKE_PASSWORD",
      "PRIVATE_FAKE_OTHER",
      "PRIVATE_FAKE_CODE",
      "approved@example.invalid",
      "synthetic-approved",
    ])
      assert.equal(publicText.includes(secret), false);
    assert.equal(
      (await stat(path.join(out, "test-only.rules.json"))).mode & 0o777,
      0o600,
    );
    assert.equal((await stat(out)).mode & 0o777, 0o700);
    await assert.rejects(prepareLiveTest(f, out));
    await chmod(f, 0o644);
    await assert.rejects(prepareLiveTest(f, path.join(dir, "rejected")));
    await chmod(f, 0o600);
    await symlink(checkout, path.join(dir, "repo-link"), "dir");
    await assert.rejects(
      privatePath(path.join(dir, "repo-link", "new-output"), {
        existing: false,
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("curl transport keeps credentials in pipes and preserves binary/status evidence without shell interpolation", async () => {
  let argv,
    settings = "",
    body = "";
  const spawn = (cmd, args) => {
    assert.equal(cmd, "curl");
    argv = args;
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdio = [child.stdin, child.stdout, child.stderr];
    child.kill = () => {};
    let bodyDone = false,
      configDone = false;
    const finish = () => {
      if (!bodyDone || !configDone) return;
      child.stdout.write(Buffer.from([0, 255, 1]));
      child.stdout.write("\nVETERANSGEO_STATUS:200:6:3:0.1");
      child.emit("close", 0);
    };
    child.stdin.on("data", (x) => (body += x));
    child.stdin.on("end", () => {
      bodyDone = true;
      finish();
    });
    const input = createReadStream(args[1]);
    input.on("data", (x) => (settings += x));
    input.on("end", () => {
      configDone = true;
      finish();
    });
    return child;
  };
  const transport = createLiveHTTP({ spawn }),
    r = await transport.request(
      "https://example.invalid/path?auth=PRIVATE_TOKEN",
      {
        method: "POST",
        headers: { Authorization: "Bearer PRIVATE_TOKEN" },
        json: { password: "PRIVATE_PASSWORD" },
      },
    );
  assert.equal(transport.evidence, "isolated-transport");
  assert.equal(argv[0], "--config");
  assert.equal(argv[1].endsWith("request.fifo"), true);
  assert.equal(
    argv.some((x) => x.includes("PRIVATE_TOKEN")),
    false,
  );
  assert.equal(settings.includes("PRIVATE_TOKEN"), true);
  assert.equal(body.includes("PRIVATE_PASSWORD"), true);
  assert.equal(r.status, 200);
  assert.equal(r.uploaded, 6);
  assert.deepEqual([...r.body], [0, 255, 1]);
});
test("live runner stops before account creation on failed target handshake and labels injected results as isolated", async () => {
  const c = config(),
    input = validateLiveConfig(c),
    calls = [];
  const transport = {
    evidence: "isolated-transport",
    request: async (url) => {
      calls.push(url);
      return {
        status: 200,
        json: () => ({ ...input.targets, firebaseProjectId: "other" }),
        uploaded: 0,
        downloaded: 10,
        seconds: 0.1,
      };
    },
  };
  const r = await runLiveTest(input, transport);
  assert.equal(r.complete, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls.some((u) => u.includes("accounts:")),
    false,
  );
  assert.equal(r.kind, "isolated-transport");
  assert.equal(r.overallClassroomReady, false);
  assert.equal(JSON.stringify(r).includes("PRIVATE_FAKE"), false);
});
test("Chromium private test-web rejects wrong Edge/Auth targets before Firebase initialization or anonymous signup", async () => {
  const { chromium } = createRequire(import.meta.url)("playwright"),
    dir = await mkdtemp(path.join(os.tmpdir(), "rehearsal-browser-"));
  let web;
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.join(
        web,
        new URL(req.url, "http://localhost").pathname === "/"
          ? "index.html"
          : new URL(req.url, "http://localhost").pathname.slice(1),
      );
      res.setHeader(
        "Content-Type",
        /\.(js|mjs)$/.test(file)
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".json")
              ? "application/json"
              : "text/html",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port,
    c = config();
  c.webOrigin = origin;
  const f = path.join(dir, "input.json");
  await writeFile(f, JSON.stringify(c), { mode: 0o600 });
  web = (await prepareLiveTest(f, path.join(dir, "prepared"))).web;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.VETERANSGEO_BROWSER || "/usr/bin/chromium",
  });
  try {
    for (const bad of ["edge", "auth"]) {
      const context = await browser.newContext();
      await context.addInitScript(() => (window.__unsafeStarts = 0));
      let accountRequests = 0;
      await context.route("**/*", (r) => {
        const u = r.request().url();
        if (u.startsWith(origin)) return r.continue();
        if (u.includes("accounts:")) {
          accountRequests++;
          return r.abort();
        }
        if (u.includes("?action=readiness"))
          return r.fulfill({
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": origin },
            body: JSON.stringify({
              ...validateLiveConfig(c).targets,
              ...(bad === "edge" ? { firebaseProjectId: "wrong" } : {}),
            }),
          });
        if (u.includes("identitytoolkit.googleapis.com/v1/projects"))
          return r.fulfill({
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
              projectId: "99999",
              authorizedDomains: [c.firebase.authDomain],
            }),
          });
        if (u.includes("firebasejs/"))
          return r.fulfill({
            contentType: "text/javascript",
            body: [
              "initializeApp",
              "getAuth",
              "onAuthStateChanged",
              "signInAnonymously",
              "getDatabase",
              "get",
              "ref",
              "push",
              "set",
              "onValue",
              "update",
            ]
              .map((k) => `export const ${k}=()=>{window.__unsafeStarts++;};`)
              .join(""),
          });
        if (u.endsWith("leaflet.js"))
          return r.fulfill({ contentType: "text/javascript", body: "" });
        return r.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", () => {});
      await page.goto(origin);
      await page
        .getByRole("alert")
        .filter({ hasText: "테스트 연결 확인 실패" })
        .waitFor();
      assert.equal(await page.evaluate(() => window.__unsafeStarts), 0);
      assert.equal(accountRequests, 0);
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});

test("synthetic fixtures are genuine decodable JPEG/WebM, generated without a camera or external network", async () => {
  const { syntheticMedia } = await import("./live-fixtures.mjs"),
    { checkSignature, validateMedia } = await import("../media-policy.js");
  const files = await syntheticMedia();
  assert.deepEqual(
    files.map((f) => f.type),
    ["image/jpeg", "video/webm"],
  );
  for (const f of files) {
    assert.ok(f.bytes.length > 100);
    const blob = new Blob([f.bytes], { type: f.type });
    validateMedia(blob);
    await checkSignature(blob);
  }
});

test("real curl over verified localhost TLS transfers binary bodies; classified as local TLS, not a Firebase/Supabase result", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rehearsal-tls-"));
  let server;
  try {
    const key = path.join(dir, "key.pem"),
      cert = path.join(dir, "cert.pem");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        key,
        "-out",
        cert,
        "-sha256",
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
      ],
      { stdio: "ignore" },
    );
    server = https.createServer(
      { key: await readFile(key), cert: await readFile(cert) },
      async (req, res) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        assert.equal(req.headers.authorization, "Bearer PRIVATE_SYNTHETIC");
        res.writeHead(200, { "Content-Type": "application/octet-stream" });
        res.end(Buffer.concat(chunks));
      },
    );
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const http = createLiveHTTP({ caFile: cert }),
      bytes = Buffer.from([0, 1, 255, 13, 10, 5]);
    const r = await http.request(
      "https://127.0.0.1:" +
        server.address().port +
        "/fixture?auth=PRIVATE_SYNTHETIC",
      {
        method: "POST",
        headers: { Authorization: "Bearer PRIVATE_SYNTHETIC" },
        bytes,
      },
    );
    assert.equal(http.evidence, "local-tls-http");
    assert.equal(r.status, 200);
    assert.equal(r.uploaded, bytes.length);
    assert.deepEqual(r.body, bytes);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing curl fails safely and releases its private FIFO without retaining an open writer", async () => {
  const spawn = () => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    queueMicrotask(() => child.emit("error", Error("unavailable")));
    return child;
  };
  await assert.rejects(
    createLiveHTTP({ spawn }).request("https://example.invalid"),
  );
});

test("private test server only serves allowlisted test-web files; parent Secrets/Rules and host rebinding are blocked", async () => {
  const { privateTestServer } = await import("./serve-live-test.mjs"),
    dir = await mkdtemp(path.join(os.tmpdir(), "rehearsal-serve-"));
  let server;
  try {
    const input = path.join(dir, "input.json");
    await writeFile(input, JSON.stringify(config()), { mode: 0o600 });
    const result = await prepareLiveTest(input, path.join(dir, "prepared"));
    const loaded = await privateTestServer(result.target);
    server = loaded.server;
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const get = (url, host = "127.0.0.1:8765") =>
      new Promise((resolve, reject) => {
        http
          .get(
            {
              host: "127.0.0.1",
              port: server.address().port,
              path: url,
              headers: { Host: host },
            },
            (r) => {
              r.resume();
              r.on("end", () => resolve(r.statusCode));
            },
          )
          .on("error", reject);
      });
    assert.equal(await get("/"), 200);
    assert.equal(await get("/rehearsal-guard.js"), 200);
    for (const file of [
      "/server-secrets.env",
      "/test-only.rules.json",
      "/../server-secrets.env",
      "/security/live-test.mjs",
    ])
      assert.equal(await get(file), 404);
    assert.equal(await get("/", "attacker.invalid"), 403);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
