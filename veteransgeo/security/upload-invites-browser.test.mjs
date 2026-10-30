// Synthetic identities/files + local PostgreSQL; never contacts operating Firebase/Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { inviteDatabase } from "./invite-fixture.mjs";
import { createMockServer } from "./mock-server.mjs";
import { digestBytes } from "../media-policy.js";
const leaflet = `const item=()=>({addTo(){return this},on(){return this},setView(){return this},setLatLng(){return this},bindPopup(){return this},openPopup(){return this},invalidateSize(){},removeLayer(){},clearLayers(){},getZoom(){return 12},dragging:{enable(){},disable(){}}});window.L={map:item,tileLayer:item,marker:item,layerGroup:item};`;
test("Chromium: scoped teachers, nine preserved media, expiry/revoke/UID/school/quota/retry, automatic auth, publication and withdrawal", async () => {
  const sql = await inviteDatabase(), f = await createMockServer({ uploadInvites: sql.store, ledger: sql.ledger });
  let browser;
  try {
    for (let n=1;n<=9;n++) {
      const key="private/preserved-"+n;
      await sql.db.query("insert into public.veterans_media(asset_id,school_id,owner_uid,work_id,object_key,size,content_type,sha256,state) values($1,'S1',$2,$3,$4,4,'image/jpeg',$5,'ready')",["p_"+String(n).padStart(64,"0"),"preserved-synthetic-"+n,"preserved-"+n,key,"a".repeat(64)]);
      f.state.objects.set(key,{bytes:new Uint8Array([255,216,255,0]),type:"image/jpeg"});
    }
    const oldRows=await sql.query("select * from public.veterans_media where work_id like 'preserved-%' order by work_id"), oldObjects=[...f.state.objects.entries()].map(([k,v])=>[k,structuredClone(v)]);
    browser = await chromium.launch({ headless: true, executablePath: process.env.VETERANSGEO_BROWSER || "/usr/bin/chromium" });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    context.setDefaultTimeout(10000);
    const errors = [], requests = [];
    await context.route("**/*", r => r.request().url().startsWith(f.origin) ? r.continue() : r.request().url().endsWith("leaflet.js") ? r.fulfill({ contentType: "text/javascript", body: leaflet }) : r.abort());
    context.on("page", p => { p.on("pageerror", e => errors.push(e.message)); p.on("request", r => requests.push(r.url())); });
    const teacher = await context.newPage();
    await teacher.goto(f.origin + "/teacher.html");
    const api = (body, uid="mock-teacher") => teacher.evaluate(async ({body,uid}) => {
      const r=await fetch('/__mock/media',{method:'POST',headers:{Authorization:'Bearer '+uid,'Content-Type':'application/json'},body:JSON.stringify(body)});
      return {status:r.status,data:await r.json()};
    },{body,uid});
    await teacher.locator("#teacherUploadInvites summary").click();
    async function issue() {
      await teacher.locator("#issueUploadInvite").click();
      await teacher.locator("#issuedUploadInvite:not([hidden])").waitFor();
      return teacher.locator("#issuedUploadInvite textarea").inputValue();
    }
    await teacher.locator("#inviteSchool").selectOption("S2");
    await teacher.locator("#issueUploadInvite").click();
    await teacher.locator("#inviteStatus").filter({hasText:"담당 학교"}).waitFor();
    assert.equal((await api({action:"invite-list",schoolId:"S2"})).status,403);
    await teacher.locator("#inviteSchool").selectOption("S1");
    const firstLink = await issue();
    const firstId=(await api({action:"invite-list",schoolId:"S1"})).data[0].id;
    assert.equal((await api({action:"invite-revoke",id:firstId},"mock-peer-teacher")).status,403);
    const peer=(await api({action:"invite-issue",schoolId:"S1"},"mock-peer-teacher")).data;
    assert.equal((await api({action:"invite-list",schoolId:"S1"})).data.length,1);
    assert.equal((await api({action:"invite-revoke",id:peer.id})).status,403);
    const student = await context.newPage();
    await student.goto(firstLink);
    await student.locator("#openWorkSubmission").click();
    await student.locator("#mediaForm [name=submissionMode]").selectOption("upload");
    await student.locator("#uploadAccessStatus").filter({ hasText: "연결 완료" }).waitFor();
    assert.ok(!student.url().includes("upload-invite") && !student.url().includes("i_"));
    assert.equal(await student.locator("#school").inputValue(), "S1");
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
    assert.equal(f.lookup("memoryTemperature2026/works/S1/mock-student"), null); // Preflight before any metadata write.
    const expiring=(await api({action:"invite-issue",schoolId:"S1"})).data;
    await sql.db.query("update public.veterans_upload_invites set expires_at=clock_timestamp()-interval '1 second' where id=$1",[expiring.id]);
    await student.locator("#workFileArea details summary").click();
    await student.locator("#workFileArea input[type=url]").fill(f.origin+"/index.html#upload-invite="+expiring.inviteToken);
    await student.getByRole("button",{name:"이 화면에서 연결",exact:true}).click();
    await student.locator("#uploadAccessStatus").filter({hasText:"만료"}).waitFor();
    assert.equal(await form.locator("[name=file]").evaluate(el=>el.files.length),1);
    const limited=(await api({action:"invite-issue",schoolId:"S1",perStudent:1})).data;
    const secondLink=f.origin+"/index.html#upload-invite="+limited.inviteToken;
    await student.locator("#workFileArea input[type=url]").fill(secondLink);
    await student.getByRole("button", { name: "이 화면에서 연결", exact: true }).click();
    await student.locator("#uploadAccessStatus").filter({ hasText: "연결 완료" }).waitFor();
    assert.equal(await student.locator("#workFileArea input[type=url]").inputValue(), "");
    assert.equal(await form.locator("[name=file]").evaluate(el => el.files.length), 1);
    // Wrong-school attempt is visible and cannot move or overwrite a started draft.
    await student.locator("#school").selectOption("S2");
    await form.locator("button[type=submit]").click();
    await student.locator("#uploadStatus").filter({ hasText: "학교가 달라요" }).waitFor();
    assert.equal(await form.locator("[name=title]").inputValue(), "가상 초안");
    await student.locator("#school").selectOption("S1");
    f.state.failPut=true;
    await form.locator("button[type=submit]").click();
    await student.locator("#uploadStatus").filter({hasText:"재시도"}).waitFor();
    assert.equal(await form.locator("[name=file]").evaluate(el=>el.files.length),1);
    const stableKey=Object.keys(f.lookup("memoryTemperature2026/works/S1/mock-student"))[0];
    f.state.failPut=false;
    await form.locator("button[type=submit]").click();
    await student.locator("#uploadStatus").filter({ hasText: "제출 완료!" }).waitFor();
    const works = Object.values(f.lookup("memoryTemperature2026/works/S1/mock-student"));
    assert.equal(works.length, 1);
    assert.equal(Object.keys(f.lookup("memoryTemperature2026/works/S1/mock-student"))[0],stableKey);
    assert.equal(works[0].activityCode, "OLD-ACTIVITY");
    assert.equal(works[0].contentType, "image/jpeg");
    const grant=(await api({action:"invite-redeem",inviteToken:limited.inviteToken},"mock-student")).data.grantToken;
    assert.equal((await api({action:"invite-check",schoolId:"S1",grantToken:grant},"mock-other")).status,403);
    const row=await sql.ledger.find(works[0].mediaAssetId), bytes=[...f.state.objects.get(row.object_key).bytes];
    const upload=(workId,uid="mock-student")=>teacher.evaluate(async ({workId,uid,grant,bytes})=>{
      const r=await fetch('/__mock/media?action=upload',{method:'POST',headers:{Authorization:'Bearer '+uid,'Content-Type':'image/jpeg','X-School-Id':'S1','X-Work-Id':workId,'X-Upload-Grant':grant},body:new Uint8Array(bytes)});
      return {status:r.status,data:await r.json()};
    },{workId,uid,grant,bytes});
    assert.equal((await upload(stableKey)).data.duplicate,true);
    const extraKey="quota-extra", extraAsset="p_"+await digestBytes(new TextEncoder().encode('S1_mock-student_'+extraKey));
    f.write('memoryTemperature2026/works/S1/mock-student/'+extraKey,{...works[0],mediaAssetId:extraAsset});
    assert.equal((await upload(extraKey)).status,429);
    f.write('memoryTemperature2026/works/S1/mock-student/'+extraKey,null);
    assert.equal((await context.request.get(f.origin+"/__mock/media?publicId="+works[0].mediaAssetId)).status(),403);
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
    assert.equal((await context.request.get(f.origin + "/__mock/media?publicId=" + asset,{headers:{Range:"bytes=0-1"}})).status(),403);
    assert.deepEqual(await sql.query("select * from public.veterans_media where work_id like 'preserved-%' order by work_id"),oldRows);
    assert.deepEqual(oldObjects.map(([k])=>[k,f.state.objects.get(k)]),oldObjects);
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
