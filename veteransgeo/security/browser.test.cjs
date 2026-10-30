// Isolated browser fixtures. No production Firebase, student data, or external requests.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../..");
const sdk = `const state=window.__fixture;export const initializeApp=()=>({});export const getAuth=()=>state.auth;export const getDatabase=()=>({});export const getStorage=()=>({});export const ref=(db,path='')=>({path});export const push=r=>{const key='fixture-id-'+(state.keyCounter=(state.keyCounter||0)+1);return {path:r.path+'/'+key,key};};export const get=async r=>{const value=r.path.includes('/teachers/')?true:r.path.includes('/submissions/')?state.record:r.path.includes('/works/')?state.workRecord:r.path.includes('/audit/')?state.audit:null;return {exists:()=>value!=null,val:()=>value};};export const set=async(r,d)=>{state.writes.push({path:r.path,data:d});if(state.deny)throw {code:'PERMISSION_DENIED'};state.data[r.path]=d;};export const update=async(r,d)=>{state.writes.push({path:r.path,data:d});};export const remove=async r=>{};export const onValue=(r,fn)=>{state.active++;queueMicrotask(()=>fn({val:()=>r.path.endsWith('/submissions')?state.submissions:r.path.endsWith('/publishedWorks')?(window.__publicWorks||state.publishedWorks):r.path.endsWith('/works')?(state.works||{}):{}}));return()=>{state.active--;};};export const signInAnonymously=async()=>{const user={uid:'fictional-student',isAnonymous:true,getIdToken:async()=>{if(state.expire)throw {code:'auth/user-token-expired'};return 'fixture-token-not-real';}};state.auth.currentUser=user;return {user};};export class GoogleAuthProvider{setCustomParameters(){}}export const signInWithPopup=async()=>({user:state.teacher});export const signInWithEmailAndPassword=signInWithPopup;export const signOut=async()=>state.listener(null);export const onAuthStateChanged=(a,fn)=>{state.listener=u=>{state.auth.currentUser=u;fn(u);};queueMicrotask(()=>state.listener(state.auth.currentUser||(state.isTeacher?state.teacher:null)));return()=>{};};export const getBlob=async()=>new Blob(['test']);export const deleteObject=async()=>{};export const uploadBytesResumable=()=>({then:fn=>Promise.resolve(fn()),on:(name,progress,error,done)=>{progress({bytesTransferred:1,totalBytes:1});queueMicrotask(done);},cancel(){}});`;
const leaflet = `const item=()=>({addTo(){return this},on(){return this},setView(){return this},setLatLng(){return this},bindPopup(){return this},openPopup(){return this},invalidateSize(){},removeLayer(){},clearLayers(){},getZoom(){return 12},dragging:{enable(){},disable(){}}});window.L={map:()=>{const m=item();m.handlers={};m.on=(k,fn)=>{m.handlers[k]=fn;return m};window.__map=m;return m;},tileLayer:item,marker:item,layerGroup:item};`;
test("student mobile/PC: steps, awareness lock, denied retry keeps same ID, official fallback, independent upload; teacher listener cleanup; public gallery", async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(file, (e, d) => {
      if (e) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".json")
            ? "application/json"
            : "text/html",
      );
      res.end(d);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.VETERANSGEO_BROWSER || "/usr/bin/chromium",
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() => {
      window.__fixture = {
        data: {},
        writes: [],
        deny: true,
        active: 0,
        isTeacher: location.pathname.endsWith("teacher.html"),
        teacher: {
          uid: "fictional-teacher",
          isAnonymous: false,
          getIdTokenResult: async () => ({ claims: { teacher: true } }),
        },
        auth: {},
        submissions: {},
        publishedWorks: window.__publicWorks || {},
      };
    });
    await context.route("**/*", (r) => {
      const u = r.request().url();
      if (u.startsWith(origin)) {
        if (u.endsWith("project-config.js"))
          return r.fulfill({
            contentType: "text/javascript",
            body: fs
              .readFileSync(
                path.join(root, "veteransgeo/project-config.js"),
                "utf8",
              )
              .replace(
                "MEDIA_UPLOAD_ENABLED = false",
                "MEDIA_UPLOAD_ENABLED = true",
              ),
          });
        return r.continue();
      }
      if (u.includes("firebasejs/"))
        return r.fulfill({ contentType: "text/javascript", body: sdk });
      if (u.endsWith("leaflet.js"))
        return r.fulfill({ contentType: "text/javascript", body: leaflet });
      return r.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/veteransgeo/index.html");
    await page.locator("#lockAwareness").waitFor();
    assert.equal(await page.locator("#school option").count(), 7);
    assert.equal(await page.locator(".step-panel").count(), 3);
    await page.locator("#activityCode").fill("TEST");
    await page.locator("#awarenessScore").selectOption("2");
    await page.locator("#lockAwareness").click();
    assert.equal(await page.locator("#awarenessScore").isDisabled(), true);
    await page.locator("#facilitySearch").click();
    await page
      .locator("#facilityStatus")
      .filter({ hasText: "아직 연결하지 못했어요" })
      .waitFor();
    await page.locator('[data-step="1"]').click();
    await page.locator("#placeName").fill("가상 시설");
    await page.locator("#manualLocationBtn").click();
    await page.evaluate(() =>
      window.__map.handlers.click({ latlng: { lat: 36, lng: 127 } }),
    );
    await page.locator("#confirmLocationBtn").click();
    await page
      .locator("#placeDescription")
      .fill("테스트 전용 가상 장소를 설명합니다.");
    await page.locator("#sourceType").selectOption("나의 판단");
    await page.locator("#sourceNote").fill("가상 테스트");
    await page.locator('[data-step="2"]').click();
    await page.locator("#scoreReason").fill("가상 테스트용 근거를 작성합니다.");
    await page
      .locator("#rememberSentence")
      .fill("가상 장소를 기억하는 테스트 문장입니다.");
    await page.locator("#keywords").fill("가상,테스트");
    await page.locator("#submitBtn").click();
    await page.locator("#msg").filter({ hasText: "저장 권한" }).waitFor();
    assert.match(await page.locator("#rememberSentence").inputValue(), /가상/);
    const firstAttempt = await page.evaluate(() => window.__fixture.writes[0]);
    await page.reload();
    await page.locator("#lockAwareness").waitFor();
    assert.equal(await page.locator("#awarenessScore").inputValue(), "2");
    assert.equal(await page.locator("#awarenessScore").isDisabled(), true);
    assert.match(await page.locator("#rememberSentence").inputValue(), /가상/);
    await page.locator('[data-step="1"]').click();
    // Restored coordinates need confirmation; editing the name deliberately clears the location.
    assert.equal(await page.locator("#placeName").inputValue(), "가상 시설");
    await page.locator("#confirmLocationBtn").click();
    await page.locator('[data-step="2"]').click();
    await page.evaluate(() => (window.__fixture.deny = false));
    await page.locator("#submitBtn").click();
    await page.locator("#msg").filter({ hasText: "등록 완료" }).waitFor();
    const writes = [
      firstAttempt,
      ...(await page.evaluate(() => window.__fixture.writes)),
    ];
    assert.equal(writes.length, 2);
    assert.equal(writes[0].path, writes[1].path);
    assert.equal(writes[1].data.awarenessOriginal.score, 2);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.locator("#openWorkSubmission").click();
    const form = page.locator("#mediaForm");
    await form.locator("[name=activityCode]").fill("TEST");
    await form.locator("[name=facilityName]").fill("가상 시설");
    await form.locator("[name=title]").fill("가상 작품");
    await form.locator("[name=introduction]").fill("테스트 전용 소개");
    await form.locator("[name=consent]").check();
    await form.locator("[name=submissionMode]").selectOption("text");
    await form.locator("button").first().click();
    await page
      .locator("#uploadStatus")
      .filter({ hasText: "제출 완료" })
      .waitFor();
    await page.route("**/project-config.js", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body: fs.readFileSync(
          path.join(root, "veteransgeo/project-config.js"),
          "utf8",
        ),
      }),
    );
    await page.reload();
    await page.locator("#openWorkSubmission").click();
    await page.locator("#mediaForm").waitFor({state:"attached"});
    assert.equal(
      await page
        .locator("#mediaForm [name=submissionMode] [value=upload]")
        .evaluate((el) => el.disabled),
      true,
    );
    await page.evaluate(() => (window.__fixture.deny = false));
    for (const mode of ["external", "text"]) {
      const f = page.locator("#mediaForm");
      for (const [key, value] of Object.entries({
        activityCode: "TEST",
        facilityName: "가상 시설",
        title: "가상 링크 작품",
        introduction: "가상 소개",
      }))
        await f.locator("[name=" + key + "]").fill(value);
      await f.locator("[name=submissionMode]").selectOption(mode);
      if (mode === "external")
        await f
          .locator("[name=externalUrl]")
          .fill("https://drive.google.com/file/d/fictional/view");
      await f.locator("[name=consent]").check();
      await f.locator("button").first().click();
      await page
        .locator("#uploadStatus")
        .filter({ hasText: "제출 완료" })
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => window.__fixture.writes.at(-1).data.submissionMode,
        ),
        mode,
      );
    }
    // Six additional school flows; S1 was exercised above with deny+reload+retry.
    for (let school = 2; school <= 7; school++) {
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(origin + "/veteransgeo/index.html");
      await page.locator("#mediaForm").waitFor({state:"attached"});
      await page.evaluate(() => (window.__fixture.deny = false));
      await page.locator("#school").selectOption("S" + school);
      await page.locator("#activityCode").fill("TEST");
      await page.locator("#awarenessScore").selectOption("1");
      await page.locator("#lockAwareness").click();
      await page.locator('[data-step="1"]').click();
      await page.locator("#placeName").fill("학교별 가상 시설");
      await page.locator("#manualLocationBtn").click();
      await page.evaluate(() =>
        window.__map.handlers.click({ latlng: { lat: 36, lng: 127 } }),
      );
      await page.locator("#confirmLocationBtn").click();
      await page
        .locator("#placeDescription")
        .fill("학교별 가상 장소 설명을 작성합니다.");
      await page.locator("#sourceType").selectOption("나의 판단");
      await page.locator("#sourceNote").fill("가상 출처");
      await page.locator('[data-step="2"]').click();
      await page
        .locator("#scoreReason")
        .fill("가상 테스트의 판단 근거를 작성합니다.");
      await page
        .locator("#rememberSentence")
        .fill("가상 테스트의 기억 문장을 작성합니다.");
      await page.locator("#keywords").fill("가상 테스트");
      await page.evaluate(() => (window.__fixture.expire = true));
      await page.locator("#submitBtn").click();
      await page.locator("#msg").filter({ hasText: "학생 연결" }).waitFor();
      assert.equal(
        await page.evaluate(() => window.__fixture.writes.length),
        0,
      );
      await page.evaluate(() => (window.__fixture.expire = false));
      await page.locator("#submitBtn").click();
      await page.locator("#msg").filter({ hasText: "등록 완료" }).waitFor();
      const w = await page.evaluate(() => window.__fixture.writes[0]);
      assert.ok(w.path.includes("/S" + school + "/fictional-student/"));
      assert.equal(w.data.schoolId, "S" + school);
    }
    // Verified fixture only: actual production cache remains empty.
    const facility = {
      schemaVersion: 1,
      status: "verified",
      updatedAt: "2026-10-29",
      crs: "EPSG:4326",
      coordinateMapping: "test fixture axes",
      license: "TEST ONLY",
      facilities: [
        {
          id: "fictional-S1",
          name: "가상 공식 시설",
          address: "가상 주소",
          region: "충남 공주",
          latitude: 36,
          longitude: 127,
          sourceUrl: "https://mfis.mpva.go.kr/fixture",
          verified: true,
        },
      ],
    };
    await page.route("**/official-facilities.json", (r) =>
      r.fulfill({ json: facility }),
    );
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(origin + "/veteransgeo/index.html");
    await page.locator("#mediaForm").waitFor({state:"attached"});
    await page.locator("#dontKnowPlace").click();
    assert.equal(await page.locator("#awarenessScore").inputValue(), "1");
    assert.equal(await page.locator("#awarenessScore").isDisabled(), true);
    await page.locator("#facilityQuery").fill("가상 공식");
    await page.locator("#facilityResults button").first().click();
    assert.equal(
      await page.locator("#placeName").inputValue(),
      "가상 공식 시설",
    );
    assert.equal(await page.locator("#address").inputValue(), "가상 주소");
    assert.equal(await page.locator("#lat").inputValue(), "36.000000");
    assert.equal(
      await page.locator("#officialStatus").inputValue(),
      "confirmed",
    );
    await page.evaluate(() =>
      window.__fixture.listener({
        uid: "different-student",
        isAnonymous: true,
        getIdToken: async () => "",
      }),
    );
    assert.equal(await page.locator("#submitBtn").isDisabled(), true);
    page.once('dialog',d=>d.accept());await page.locator('#clearDraft').click();await page.locator('#mediaForm').waitFor({state:'attached'});assert.equal(await page.locator('#placeName').inputValue(),'');
    await page.goto(origin + "/veteransgeo/teacher.html");
    await page.locator("#dash").waitFor({ state: "visible" });
    const record = {
      schoolId: "S1",
      activityCode: "TEST",
      category: "6·25전쟁·호국",
      placeOrigin: "student_suggested",
      placeName: "=가상 시설",
      placeDescription: "가상 테스트 시설을 설명하는 문장입니다.",
      address: "가상",
      latitude: 36,
      longitude: 127,
      officialStatus: "not_checked",
      awarenessScore: 2,
      importance: 3,
      visibility: 2,
      scoreReason: "가상 테스트 점수 근거를 작성합니다.",
      sourceType: "나의 판단",
      sourceNote: "가상 테스트",
      rememberSentence: "가상 테스트 기억 문장입니다.",
      keywords: "A".repeat(180),
      message: "",
      createdAt: 1,
    };
    await page.evaluate((record) => {
      window.__fixture.record = record;
      window.__fixture.submissions = {
        S1: { "fictional-student": { one: record } },
      };
      window.__fixture.listener(window.__fixture.teacher);
    }, record);
    await page.locator(".edit").waitFor();
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"teacher mobile long keyword overflow");await page.setViewportSize({width:1440,height:1000});
    const download = page.waitForEvent("download");
    await page.locator("#egisBtn").click();
    const csv = fs.readFileSync(await (await download).path(), "utf8");
    assert.ok(csv.startsWith('\ufeff"name","address","latitude","longitude"'));
    assert.ok(csv.includes("'=가상 시설"));
    await page.locator(".edit").click();
    await page.locator("dialog [name=placeName]").fill("교사 수정 가상 시설");
    await page.locator("dialog button").first().click();
    await page.waitForFunction(
      () =>
        !document.querySelector("dialog") ||
        document.querySelector("dialog [role=alert]").textContent,
    );
    if (await page.locator("dialog").count())
      throw Error(await page.locator("dialog [role=alert]").textContent());
    const edits = await page.evaluate(
      () => window.__fixture.writes.at(-1).data,
    );
    assert.equal(
      edits["memoryTemperature2026/published/S1_fictional-student_one"],
      null,
    );
    assert.equal(
      edits[
        "memoryTemperature2026/submissions/S1/fictional-student/one/revision"
      ],
      1,
    );
    assert.equal(
      Object.keys(edits).some((k) => k.endsWith("/awarenessScore")),
      false,
    );
    assert.equal(
      Object.keys(edits).some((k) =>
        k.startsWith("memoryTemperature2026/audit/"),
      ),
      true,
    );
    await page.locator(".pub").click();
    const publication = await page.evaluate(() =>
      window.__fixture.writes.at(-1),
    );
    assert.match(publication.path, /\/published\/p_[a-f0-9]{64}$/);
    assert.equal("uid" in publication.data, false);
    assert.equal("activityCode" in publication.data, false);
    page.once("dialog", (d) => d.accept());
    await page.locator(".del").click();
    const archived = await page.evaluate(
      () => window.__fixture.writes.at(-1).data,
    );
    assert.ok(Object.keys(archived).some((k) => k.endsWith("/deletedAt")));
    assert.equal(
      Object.keys(archived).some((k) => k.endsWith("/awarenessScore")),
      false,
    );
    await page.evaluate(
      () =>
        (window.__fixture.audit = {
          test: {
            before: { placeName: "<img src=x onerror=alert(1)>" },
            after: { placeName: "가상 수정" },
            editor: "fictional-teacher",
            editedAt: 1,
          },
        }),
    );
    await page.locator(".history").click();
    await page.locator("dialog pre").waitFor();
    assert.equal(await page.locator("dialog img").count(), 0);
    assert.match(await page.locator("dialog pre").textContent(), /가상 수정/);
    await page.locator("dialog button").click();
    await page.evaluate(() => {
      window.__fixture.workRecord = {
        schoolId: "S1",
        activityCode: "PRIVATE_ACTIVITY_TEST",
        facilityName: "가상 시설",
        title: "가상 작품",
        type: "홍보 기획안",
        introduction: "가상 설명",
        submissionMode: "text",
        status: "pending",
        createdAt: 1,
      };
      window.__fixture.works = {
        S1: { "fictional-student": { work: window.__fixture.workRecord } },
      };
      window.__fixture.listener(window.__fixture.teacher);
    });
    await page
      .locator("#workList button")
      .filter({ hasText: "검토 후 공개 승인" })
      .waitFor();
    page.once("dialog", (d) => d.accept());
    await page
      .locator("#workList button")
      .filter({ hasText: "검토 후 공개 승인" })
      .click();
    const workReview = await page.evaluate(
      () => window.__fixture.writes.at(-1).data,
    );
    const pubEntry = Object.entries(workReview).find(
      ([k, v]) => k.includes("/publishedWorks/p_") && v,
    );
    assert.ok(pubEntry);
    assert.equal(
      JSON.stringify(pubEntry[1]).includes("PRIVATE_ACTIVITY_TEST"),
      false,
    );
    assert.equal(
      JSON.stringify(pubEntry[1]).includes("fictional-student"),
      false,
    );
    assert.equal("entryId" in pubEntry[1], false);
    assert.equal(
      Object.keys(workReview).some((k) => k.endsWith("/status")),
      true,
    );
    assert.equal(await page.evaluate(() => window.__fixture.active), 3);
    await page.evaluate(() => window.__fixture.listener(null));
    await page.locator("#dash").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => window.__fixture.active), 0);
    await context.addInitScript(() => {
      window.__publicWorks = {
        a: {
          status: "approved",
          schoolId: "S1",
          facilityName: "가상 시설",
          title: "승인 가상 작품",
          type: "포스터",
          introduction: "가상 소개",
          storagePath: "published-media/a/file",
          contentType: "image/jpeg",
        },
        b: {
          status: "pending",
          schoolId: "S1",
          facilityName: "가상 시설",
          title: "미승인 작품",
          type: "포스터",
          introduction: "비공개",
        },
      };
    });
    await page.goto(origin + "/veteransgeo/public.html");
    await page
      .locator("#galleryStatus")
      .filter({ hasText: "승인 작품 1개" })
      .waitFor();
    assert.equal(
      await page
        .locator("#galleryItems")
        .getByText("미승인 작품", { exact: true })
        .count(),
      0,
    );
    await page.locator("#gallerySchool").selectOption("S2");
    await page
      .locator("#galleryStatus")
      .filter({ hasText: "승인 작품 0개" })
      .waitFor();
    assert.equal(
      (await page.locator("body").textContent()).includes("fictional-student"),
      false,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});
