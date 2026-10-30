import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { createMockServer } from "./mock-server.mjs";
const leaflet = `const item=()=>({addTo(){return this},on(){return this},setView(){return this},setLatLng(){return this},bindPopup(){return this},openPopup(){return this},invalidateSize(){},removeLayer(){},clearLayers(){},getZoom(){return 12},dragging:{enable(){},disable(){}}});window.L={map:item,tileLayer:item,marker:item,layerGroup:item};`;
test("real Chromium + local mock gateway: image compression/upload/retry, video, teacher review/history, feed/revocation, text/link independence, cancel and responsive layout", async () => {
  const f = await createMockServer(),
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.VETERANSGEO_BROWSER || "/usr/bin/chromium",
    });
  const errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    context.setDefaultTimeout(8000);
    await context.route("**/*", (r) =>
      r.request().url().startsWith(f.origin)
        ? r.continue()
        : r.request().url().endsWith("leaflet.js")
          ? r.fulfill({ contentType: "text/javascript", body: leaflet })
          : r.abort(),
    );
    const student = await context.newPage();
    student.on("pageerror", (e) => errors.push(e.message));
    await student.goto(f.origin + "/");
    await student.locator("#openWorkSubmission").click();
    const form = student.locator("#mediaForm");
    assert.equal(await student.locator(".step-panel").count(), 3);
    assert.equal(await form.locator("[name=schoolId] option").count(), 7);
    assert.equal(await form.locator("[name=schoolId]").isHidden(), true);
    assert.match(await student.locator("#workSchoolDisplay").innerText(), /공주여자고등학교/);
    await student.locator("#school").selectOption("S2");
    assert.equal(await form.locator("[name=schoolId]").inputValue(), "S2");
    await student.locator("#school").selectOption("S1");
    assert.equal(await form.locator("[name=schoolId]").inputValue(), "S1");
    async function fill(title, type = "사진", mode = "upload") {
      await form.locator("[name=type]").selectOption(type);
      await form.locator("[name=submissionMode]").selectOption(mode);
      for (const [k, v] of Object.entries({
        activityCode: "TEST",
        facilityName: "가상 장소",
        title,
        introduction: "개인정보 없는 가상 작품 소개",
      }))
        await form.locator("[name=" + k + "]").fill(v);
      await form.locator("[name=consent]").check();
    }
    const png = Buffer.from(
      await student.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 64;
        c.getContext("2d").fillRect(0, 0, 64, 64);
        return c.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    );
    await fill("사진 가상 작품");
    await form.locator("[name=file]").setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: png,
    });
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "파일 준비 완료" })
      .waitFor();
    assert.equal(await student.locator("#workPreview img").count(), 1);
    f.state.failPut = true;
    await form.locator("button[type=submit]").click();
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "재시도" })
      .waitFor();
    assert.equal(
      await form.locator("[name=title]").inputValue(),
      "사진 가상 작품",
    );
    const firstId = Object.keys(
      f.lookup("memoryTemperature2026/works/S1/mock-student"),
    )[0];
    f.state.failPut = false;
    await form.locator("button[type=submit]").click();
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "제출 완료!" })
      .waitFor();
    const first = f.lookup(
      "memoryTemperature2026/works/S1/mock-student/" + firstId,
    );
    assert.equal(first.contentType, "image/jpeg");
    assert.ok(first.size <= 3 * 1024 ** 2);
    assert.equal(
      Object.keys(f.lookup("memoryTemperature2026/works/S1/mock-student"))
        .length,
      1,
    );
    assert.equal(f.state.objects.size, 1);
    assert.equal(
      await student.locator("#uploadProgress").evaluate((el) => el.value),
      100,
    );
    const teacher = await context.newPage();
    teacher.on("pageerror", (e) => errors.push(e.message));
    await teacher.goto(f.origin + "/teacher.html");
    await teacher.locator("#workList article").waitFor();
    await teacher
      .getByRole("button", { name: "미리보기", exact: true })
      .click();
    await teacher.locator("#workList img").waitFor();
    teacher.once("dialog", (d) => d.accept());
    await teacher
      .getByRole("button", { name: "검토 후 공개 승인", exact: true })
      .click();
    await teacher
      .locator("#workStatus")
      .filter({ hasText: "저장했어요" })
      .waitFor();
    const pubId = Object.keys(
      f.lookup("memoryTemperature2026/publishedWorks"),
    )[0];
    const publicData = f.lookup(
      "memoryTemperature2026/publishedWorks/" + pubId,
    );
    assert.match(pubId, /^p_[a-f0-9]{64}$/);
    assert.equal("activityCode" in publicData, false);
    assert.equal("mediaAssetId" in publicData, false);
    assert.equal("storagePath" in publicData, false);
    const pub = await context.newPage();
    pub.on("pageerror", (e) => errors.push(e.message));
    await pub.goto(f.origin + "/public.html");
    await pub
      .locator("#galleryStatus")
      .filter({ hasText: "승인 작품 1개" })
      .waitFor();
    assert.equal(await pub.locator("#galleryMore").isVisible(), false);
    await pub.getByRole("button", { name: "승인 작품 보기" }).click();
    await pub.locator("dialog img").waitFor();
    assert.equal(await pub.locator("video[autoplay]").count(), 0);
    let direct = await fetch(f.origin + "/__mock/media?publicId=" + pubId);
    assert.equal(direct.status, 200);
    await teacher
      .getByRole("button", { name: "비공개 전환", exact: true })
      .click();
    await pub
      .locator("#galleryStatus")
      .filter({ hasText: "승인 작품 0개" })
      .waitFor();
    assert.equal(await pub.locator("dialog").count(), 0);
    direct = await fetch(f.origin + "/__mock/media?publicId=" + pubId);
    assert.equal(direct.status, 403);
    await teacher
      .getByRole("button", { name: "수정 이력", exact: true })
      .click();
    await teacher.locator("dialog pre").waitFor();
    assert.match(await teacher.locator("dialog pre").textContent(), /approved/);
    await teacher.locator("dialog button").click();
    await teacher.getByRole("button", { name: "보관", exact: true }).click();
    await teacher.getByRole("button", { name: "복원", exact: true }).waitFor();
    await teacher.getByRole("button", { name: "복원", exact: true }).click();
    await fill("영상 가상 작품", "영상");
    const webm = await student.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      c.getContext("2d").fillRect(0, 0, 32, 32);
      const stream = c.captureStream(5),
        rec = new MediaRecorder(stream, { mimeType: "video/webm" }),
        chunks = [];
      return new Promise((resolve) => {
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]);
        };
        rec.start();
        setTimeout(() => rec.stop(), 300);
      });
    });
    await form.locator("[name=file]").setInputFiles({
      name: "synthetic.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(webm),
    });
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "파일 준비 완료" })
      .waitFor();
    await form.locator("button[type=submit]").click();
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "제출 완료!" })
      .waitFor();
    assert.equal(f.state.objects.size, 2);
    await fill("잘못된 파일");
    await form.locator("[name=file]").setInputFiles({
      name: "fake.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("<html>invalid</html>"),
    });
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "형식이 맞지" })
      .waitFor();
    assert.equal(f.state.objects.size, 2);
    // A genuine in-flight request: cancel must keep the title and not add another file.
    await fill("취소할 작품");
    await form.locator("[name=file]").setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: png,
    });
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "파일 준비 완료" })
      .waitFor();
    await student.route("**/__mock/media?action=upload", async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        await r.abort();
      } catch {}
    });
    await form.locator("button[type=submit]").click();
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "파일을 올리고" })
      .waitFor();
    await student.locator("#cancelUpload").click();
    await student
      .locator("#uploadStatus")
      .filter({ hasText: "취소" })
      .waitFor();
    assert.equal(
      await form.locator("[name=title]").inputValue(),
      "취소할 작품",
    );
    student.once("dialog", (d) => d.accept());
    await student.locator("#clearWorkDraft").click();
    await student.unroute("**/__mock/media?action=upload");
    for (const [type, mode] of [
      ["글", "text"],
      ["링크", "external"],
    ]) {
      await fill(type + " 작품", type, mode);
      if (mode === "external")
        await form
          .locator("[name=externalUrl]")
          .fill("https://drive.google.com/file/d/synthetic/view");
      await form.locator("button[type=submit]").click();
      await student
        .locator("#uploadStatus")
        .filter({ hasText: "제출 완료!" })
        .waitFor();
    }
    for (const width of [390, 800, 1440]) {
      await pub.setViewportSize({ width, height: 1000 });
      assert.ok(
        await pub.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    await teacher
      .getByRole("button", { name: "학생 원본 보기", exact: true })
      .first()
      .click();
    await teacher.locator("dialog pre").waitFor();
    await teacher.evaluate(async () => {
      const sdk = await import("/__mock/firebase.js");
      await sdk.signOut();
    });
    await teacher.locator("#dash").waitFor({ state: "hidden" });
    assert.equal(await teacher.locator("dialog").count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => f.server.close(resolve));
  }
});
