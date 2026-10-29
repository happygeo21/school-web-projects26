// Tests the actual allowlisted build under the Pages repository subpath.
// Firebase and Leaflet are fixtures; no external request reaches a network service.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { checkout } from "./live-config.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const prefix = "/school-web-projects26/";
test("Pages artifact: subpath imports/CSS/JSON, private 404, three pages and responsive gallery (fixtures only)", async () => {
  const { files } = JSON.parse(
    await readFile(checkout + "/scripts/public-files.json", "utf8"),
  );
  const allowed = new Set(files);
  const selected = files.filter((f) => f.startsWith("veteransgeo/"));
  const fixture = await readFile(
    new URL("browser.test.cjs", import.meta.url),
    "utf8",
  );
  const sdk = fixture.match(/const sdk = `([\s\S]*?)`;/)[1];
  const leaflet = fixture.match(/const leaflet = `([\s\S]*?)`;/)[1];
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    let file = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
    if (file.endsWith("/")) file += "index.html";
    if (!allowed.has(file)) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(checkout + "/_site/" + file);
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
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  let browser;
  try {
    const hashes = {};
    for (const file of selected) {
      const response = await fetch(origin + prefix + file);
      assert.equal(response.status, 200, file);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert(
        bytes.equals(await readFile(checkout + "/" + file)),
        "Stale artifact: " + file,
      );
      hashes[file] = createHash("sha256").update(bytes).digest("hex");
      if (!/\.(js|html|css)$/.test(file)) continue;
      const text = bytes.toString("utf8");
      const specs = [
        ...text.matchAll(
          /\b(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g,
        ),
        ...text.matchAll(/(?:src|href)=["']([^"']+)["']/g),
        ...text.matchAll(/(?:fetch\(\s*|url\(\s*)["'](\.[^"']+)["']/g),
      ];
      for (const [, spec] of specs) {
        if (spec.includes("${") || /^(?:[a-z]+:|\/\/|#)/i.test(spec)) continue;
        const u = new URL(spec, origin + prefix + file);
        assert(
          u.pathname.startsWith(prefix),
          "Reference escapes Pages subpath: " + file,
        );
        let target = u.pathname.slice(prefix.length);
        if (target.endsWith("/")) target += "index.html";
        assert(
          allowed.has(target),
          "Reference omitted from manifest: " + file + " -> " + target,
        );
      }
    }
    for (const file of [
      "security/database.rules.json",
      "security/package.json",
      "server/gateway.mjs",
      "server/supabase-key.mjs",
      "supabase/functions/media/index.ts",
      "supabase/migrations/202610290001_private_media.sql",
      "config.json",
      "server-secrets.env",
    ])
      assert.equal(
        (await fetch(origin + prefix + "veteransgeo/" + file)).status,
        404,
      );
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.VETERANSGEO_BROWSER || "/usr/bin/chromium",
    });
    const errors = [],
      localFailures = [],
      externalBlocked = new Set(),
      loaded = new Set();
    const context = await browser.newContext();
    context.setDefaultTimeout(7000);
    await context.addInitScript(() => {
      window.__fixture = {
        data: {},
        writes: [],
        active: 0,
        auth: {},
        submissions: {},
        publishedWorks: {},
        teacher: { uid: "fictional-teacher", isAnonymous: false },
      };
    });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(origin + "/")) return route.continue();
      externalBlocked.add(new URL(url).hostname);
      if (
        /^https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-[a-z-]+\.js$/.test(
          url,
        )
      )
        return route.fulfill({ contentType: "text/javascript", body: sdk });
      if (url === "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js")
        return route.fulfill({ contentType: "text/javascript", body: leaflet });
      if (url.endsWith("leaflet.css"))
        return route.fulfill({ contentType: "text/css", body: "" });
      return route.abort();
    });
    context.on("page", (page) => {
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.url().startsWith(origin + "/")) {
          loaded.add(new URL(r.url()).pathname);
          if (r.status() !== 200) localFailures.push(r.url());
        }
      });
    });
    const student = await context.newPage();
    await student.goto(origin + prefix + "veteransgeo/");
    await student.locator("#lockAwareness").waitFor();
    assert.equal(await student.locator(".step-panel").count(), 3);
    assert.equal(await student.locator("#school option").count(), 7);
    await student.locator("#awarenessScore").selectOption("2");
    await student.locator("#lockAwareness").click();
    await student.locator("#facilitySearch").click();
    await student
      .locator("#facilityStatus")
      .filter({ hasText: "아직 연결하지 못했어요" })
      .waitFor();
    await student.locator("#openWorkSubmission").click();
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "파일 저장소는 아직 연결 전" })
      .waitFor();
    assert.equal(
      await student
        .locator("#mediaForm [name=submissionMode] option[value=upload]")
        .evaluate((el) => el.disabled),
      true,
    );
    const teacher = await context.newPage();
    await teacher.goto(origin + prefix + "veteransgeo/teacher.html");
    await teacher.locator("#loginMsg").waitFor({ state: "attached" });
    const publicPage = await context.newPage();
    await publicPage.goto(origin + prefix + "veteransgeo/public.html");
    await publicPage.locator("#gallery").waitFor();
    for (const [width, columns] of [
      [390, 1],
      [820, 2],
      [1440, 3],
    ]) {
      await publicPage.setViewportSize({ width, height: 1000 });
      const count = await publicPage
        .locator("#galleryItems")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(/\s+/).length,
        );
      assert.equal(count, columns);
      assert(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    for (const asset of [
      "media.js",
      "media-gallery.js",
      "media-provider.js",
      "media-config.js",
      "media-policy.js",
      "media.css",
      "official-facilities.json",
    ])
      assert(
        loaded.has(prefix + "veteransgeo/" + asset),
        "Browser did not load " + asset,
      );
    assert.deepEqual(errors, []);
    assert.deepEqual(localFailures, []);
    console.log(
      JSON.stringify({
        evidence: "local-pages-artifact-with-SDK-map-fixtures",
        publicFiles: files.length,
        veteransgeoFiles: selected.length,
        externalServicesReached: false,
        interceptedHosts: [...externalBlocked].sort(),
        pageSHA256: Object.fromEntries(
          ["index.html", "teacher.html", "public.html"].map((p) => [
            p,
            hashes["veteransgeo/" + p],
          ]),
        ),
        realServerValidated: false,
      }),
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
});
