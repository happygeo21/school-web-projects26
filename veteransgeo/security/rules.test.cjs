const { test, before, after } = require("node:test");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const { ref, set, get, update } = require("firebase/database");
const { ref: sr, uploadBytes, getBytes } = require("firebase/storage");
let env;
const ROOT = "memoryTemperature2026";
const anon = (uid) =>
  env.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  });
const teacher = () =>
  env.authenticatedContext("teacher", {
    teacher: true,
    firebase: { sign_in_provider: "password" },
  });
const data = (school) => ({
  schemaVersion: 2,
  schoolId: school,
  createdAt: Date.now() - 1000,
  activityCode: "TEST",
  category: "6·25전쟁·호국",
  placeOrigin: "student_suggested",
  placeName: "가상 테스트 시설",
  placeDescription: "실존 학생을 사용하지 않는 가상 자료입니다.",
  address: "가상 주소",
  latitude: 36,
  longitude: 127,
  officialStatus: "not_checked",
  awarenessScore: 1,
  awarenessOriginal: {
    score: 1,
    capturedAt: Date.now() - 2000,
    placeName: "가상 테스트 시설",
    timing: "before-exploration",
  },
  importance: 3,
  visibility: 2,
  scoreReason: "가상 테스트 자료만으로 평가합니다.",
  sourceType: "나의 판단",
  sourceNote: "테스트 전용",
  rememberSentence: "가상 활동 자료를 기억하는 테스트 문장입니다.",
  keywords: "가상,테스트",
  message: "",
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-veteransgeo",
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: fs.readFileSync(__dirname + "/database.rules.json", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: fs.readFileSync(__dirname + "/storage.rules", "utf8"),
    },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    await set(ref(c.database(), ROOT + "/teachers/teacher"), true);
  });
});
after(async () => {
  await env?.cleanup();
});
test("7 schools: own submission, idempotent retry, no sibling read/write or anonymous-free access", async () => {
  for (let i = 1; i <= 7; i++) {
    const school = "S" + i,
      p = ROOT + "/submissions/" + school + "/student/one",
      d = data(school);
    await assertSucceeds(set(ref(anon("student").database(), p), d));
    await assertSucceeds(set(ref(anon("student").database(), p), d));
    await assertSucceeds(get(ref(anon("student").database(), p)));
    await assertFails(get(ref(anon("other").database(), p)));
    await assertFails(set(ref(anon("other").database(), p), d));
    await assertFails(get(ref(env.unauthenticatedContext().database(), p)));
  }
  await assertFails(
    get(ref(anon("student").database(), ROOT + "/submissions")),
  );
});
test("validation and raw awareness immutable, even for approved teacher", async () => {
  const p = ROOT + "/submissions/S1/student/one";
  await assertFails(update(ref(teacher().database(), p), { latitude: 127 }));
  await assertFails(
    update(ref(teacher().database(), p), { awarenessScore: 4 }),
  );
  await assertSucceeds(
    update(ref(teacher().database(), p), {
      placeName: "교사 수정 가상 시설",
      revision: 1,
      updatedBy: "teacher",
      updatedAt: Date.now() - 1,
    }),
  );
  await assertFails(
    set(
      ref(anon("student").database(), ROOT + "/submissions/S8/student/new"),
      data("S8"),
    ),
  );
});
test("only approved teacher can publish; audit is append-only; atomic withdraw and edit", async () => {
  const p = ROOT + "/published/test";
  await assertFails(
    set(ref(anon("student").database(), p), { placeName: "가상" }),
  );
  await assertFails(
    set(
      ref(
        env.authenticatedContext("unapproved", { teacher: true }).database(),
        p,
      ),
      { placeName: "가상" },
    ),
  );
  await assertSucceeds(
    set(ref(teacher().database(), p), { placeName: "가상" }),
  );
  await assertSucceeds(get(ref(env.unauthenticatedContext().database(), p)));
  const log = {
    before: { placeName: "전" },
    after: { placeName: "후" },
    editor: "teacher",
    editedAt: Date.now() - 1,
  };
  await assertSucceeds(
    update(ref(teacher().database()), {
      [p]: null,
      [ROOT + "/audit/test/one"]: log,
    }),
  );
  await assertFails(
    set(ref(teacher().database(), ROOT + "/audit/test/one"), {
      ...log,
      editor: "other",
    }),
  );
  await assertFails(get(ref(anon("student").database(), ROOT + "/audit")));
});
test("private media hidden; size/MIME constraints; teacher-only approved copy; revocation", async () => {
  const path = "student-media/S1/student/work/file",
    file = new Uint8Array([255, 216, 255, 0]);
  const storage = anon("student").storage();
  await assertSucceeds(
    uploadBytes(sr(storage, path), file, { contentType: "image/jpeg" }),
  );
  await assertFails(getBytes(sr(env.unauthenticatedContext().storage(), path)));
  await assertFails(getBytes(sr(anon("other").storage(), path)));
  await assertFails(
    uploadBytes(sr(storage, path), file, { contentType: "image/svg+xml" }),
  );
  await assertFails(
    uploadBytes(sr(storage, path), new Uint8Array(10 * 1024 * 1024 + 1), {
      contentType: "image/jpeg",
    }),
  );
  await assertFails(
    uploadBytes(sr(storage, path), new Uint8Array(100 * 1024 * 1024 + 1), {
      contentType: "video/mp4",
    }),
  );
  const pub = "published-media/test/file";
  await assertFails(
    uploadBytes(sr(storage, pub), file, {
      contentType: "image/jpeg",
      customMetadata: { approved: "true" },
    }),
  );
  await assertSucceeds(
    uploadBytes(sr(teacher().storage(), pub), file, {
      contentType: "image/jpeg",
      customMetadata: { approved: "true" },
    }),
  );
  await assertSucceeds(
    getBytes(sr(env.unauthenticatedContext().storage(), pub)),
  );
});
test("independent media metadata: owner create, teacher review, public collection isolated", async () => {
  const path = ROOT + "/works/S1/student/work",
    d = {
      schoolId: "S1",
      activityCode: "TEST",
      facilityName: "가상 시설",
      title: "가상 작품",
      type: "포스터",
      introduction: "가상 소개",
      entryId: "",
      submissionMode: "upload",
      storagePath: "student-media/S1/student/work/file",
      contentType: "image/jpeg",
      size: 4,
      status: "pending",
      createdAt: Date.now() - 1,
    };
  await assertSucceeds(set(ref(anon("student").database(), path), d));
  await assertFails(get(ref(env.unauthenticatedContext().database(), path)));
  await assertFails(
    update(ref(anon("student").database(), path), { status: "approved" }),
  );
  await assertSucceeds(
    update(ref(teacher().database(), path), {
      status: "approved",
      reviewedBy: "teacher",
      reviewedAt: Date.now() - 1,
    }),
  );
  await assertFails(
    set(ref(anon("student").database(), ROOT + "/publishedWorks/test"), d),
  );
});
