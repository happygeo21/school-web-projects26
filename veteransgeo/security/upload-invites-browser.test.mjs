// Synthetic identities/files + local PostgreSQL; never contacts operating Firebase/Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { inviteDatabase } from "./invite-fixture.mjs";
import { createMockServer } from "./mock-server.mjs";
const leaflet = `const item=()=>({addTo(){return this},on(){return this},setView(){return this},setLatLng(){return this},bindPopup(){return this},openPopup(){return this},invalidateSize(){},removeLayer(){},clearLayers(){},getZoom(){return 12},dragging:{enable(){},disable(){}}});window.L={map:item,tileLayer:item,marker:item,layerGroup:item};`;
test("Chromium: teacher timed links, automatic anonymous auth, fragment scrubbing, no persistent tokens, revoke/reconnect preserves selected File and draft, 3 pages/steps", async () => {
  const sql = await inviteDatabase(), f = await createMockServer({ uploadInvites: sql.store, ledger: sql.ledger });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.VETERANSGEO_BROWSER || "/usr/bin/chromium" });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    context.setDefaultTimeout(10000);
    const errors = [], requests = [];
    await context.route("**/*", r => r.request().url().startsWith(f.origin) ? r.continue() : r.request().url().endsWith("leaflet.js") ? r.fulfill({ contentType: "text/javascript", body: leaflet }) : r.abort());
    context.on("page", p => { p.on("pageerror", e => errors.push(e.message)); p.on("request", r => requests.push(r.url())); });
    const teacher = await context.newPage();
    await teacher.goto(f.origin + "/teacher.html");
    await teacher.locator("#teacherUploadInvites summary").click();
    async function issue() {
      await teacher.locator("#issueUploadInvite").click();
      await teacher.locator("#issuedUploadInvite:not([hidden])").waitFor();
      return teacher.locator("#issuedUploadInvite textarea").inputValue();
    }
    await teacher.locator("#inviteSchool").selectOption("S2");
    const firstLink = await issue();
    const student = await context.newPage();
    await student.goto(firstLink);
    await student.locator("#openWorkSubmission").click();
    await student.locator("#mediaForm [name=submissionMode]").selectOption("upload");
    await student.locator("#uploadAccessStatus").filter({ hasText: "연결 완료" }).waitFor();
    assert.ok(!student.url().includes("upload-invite") && !student.url().includes("i_"));
    assert.equal(await student.locator("#school").inputValue(), "S2");
    assert.equal(await student.locator(".step-panel").count(), 3);
    assert.equal(await student.locator("[name=uploadCode]").count(), 0);
    assert.equal(await student.locator("#mediaForm [name=schoolId]").isHidden(), true);
    const form = student.locator("#mediaForm");
    for (const [k, v] of Object.entries({ activityCode: "OLD-ACTIVITY", title: "가상 초안", introduction: "가상 소개 보존", facilityName: "가상 장소" }))
      await form.locator("[name=" + k + "]").fill(v);
    await form.locator("[name=consent]").check();
    const png = Buffer.from(await student.evaluate(() => { const c = document.createElement("canvas"); c.width = c.height = 16; c.getContext("2d").fillRect(0,0,16,16); return c.toDataURL("image/png").split(",")[1]; }), "base64");
    await form.locator("[name=file]").setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: png });
    await student.locator("#uploadStatus").filter({ hasText: "파일 준비 완료" }).waitFor();
    // Immediate revoke must also invalidate a previously redeemed grant.
    await teacher.locator("#uploadInviteList button").first().click();
    await teacher.locator("#inviteStatus").filter({ hasText: "폐기했어요" }).waitFor();
    assert.equal(await teacher.locator("#issuedUploadInvite textarea").inputValue(), "");
    await form.locator("button[type=submit]").click();
    await student.locator("#uploadStatus").filter({ hasText: "만료" }).waitFor();
    assert.equal(await form.locator("[name=title]").inputValue(), "가상 초안");
    assert.equal(await form.locator("[name=file]").evaluate(el => el.files.length), 1);
    assert.equal(f.lookup("memoryTemperature2026/works/S2/mock-student"), null); // Preflight before any metadata write.
    const secondLink = await issue();
    await student.locator("#workFileArea details summary").click();
    await student.locator("#workFileArea input[type=url]").fill(secondLink);
    await student.getByRole("button", { name: "이 화면에서 연결", exact: true }).click();
    await student.locator("#uploadAccessStatus").filter({ hasText: "연결 완료" }).waitFor();
    assert.equal(await student.locator("#workFileArea input[type=url]").inputValue(), "");
    assert.equal(await form.locator("[name=file]").evaluate(el => el.files.length), 1);
    // Wrong-school attempt is visible and cannot move or overwrite a started draft.
    await student.locator("#school").selectOption("S1");
    await form.locator("button[type=submit]").click();
    await student.locator("#uploadStatus").filter({ hasText: "학교가 달라요" }).waitFor();
    assert.equal(await form.locator("[name=title]").inputValue(), "가상 초안");
    await student.locator("#school").selectOption("S2");
    await form.locator("button[type=submit]").click();
    await student.locator("#uploadStatus").filter({ hasText: "제출 완료!" }).waitFor();
    const works = Object.values(f.lookup("memoryTemperature2026/works/S2/mock-student"));
    assert.equal(works.length, 1);
    assert.equal(works[0].activityCode, "OLD-ACTIVITY");
    assert.equal(works[0].contentType, "image/jpeg");
    const tokens = [firstLink, secondLink].map(s => new URL(s).hash.slice(15));
    const persisted = await student.evaluate(() => JSON.stringify({ local: { ...localStorage }, tab: { ...sessionStorage } }));
    assert.ok(!/i_[a-f0-9]{64}|g_[a-f0-9]{64}/.test(persisted + JSON.stringify(f.tree)));
    assert.ok(requests.every(url => !/[#?&]upload-invite=/.test(url) && !/i_[a-f0-9]{64}|g_[a-f0-9]{64}/.test(url)));
    assert.ok(tokens.every(t => !persisted.includes(t)));
    // Same-tab replacement via hash also scrubs immediately and does not navigate/reload.
    await student.evaluate(h => { window.__sameDocument = true; location.hash = h; }, new URL(secondLink).hash);
    await student.waitForFunction(() => !location.hash);
    assert.equal(await student.evaluate(() => window.__sameDocument), true);
    // Teacher/publication paths still work with an invite-authorized real SQL ledger.
    await teacher.locator("#workList article").waitFor();
    teacher.once("dialog", d => d.accept());
    await teacher.getByRole("button", { name: "검토 후 공개 승인", exact: true }).click();
    await teacher.locator("#workStatus").filter({ hasText: "저장했어요" }).waitFor();
    const asset = works[0].mediaAssetId;
    assert.equal((await context.request.get(f.origin + "/__mock/media?publicId=" + asset)).status(), 200);
    await teacher.getByRole("button", { name: "비공개 전환", exact: true }).click();
    await teacher.locator("#workList .media-state").filter({ hasText: "비공개" }).waitFor();
    assert.equal((await context.request.get(f.origin + "/__mock/media?publicId=" + asset)).status(), 403);
    const gallery = await context.newPage(); await gallery.goto(f.origin + "/public.html");
    assert.ok(await gallery.locator("body").innerText());
    for (const width of [390, 820, 1280]) {
      await student.setViewportSize({ width, height: 900 });
      assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    }
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser?.close(); await new Promise(r => f.server.close(r)); await sql.close(); }
});
