// Opt-in real TEST projects only. Not run by CI, never falls back to repository Firebase settings.
import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  readLiveConfig,
  privatePath,
  validateLiveConfig,
} from "./live-config.mjs";
import {
  assertReadiness,
  assertAuthProject,
} from "../server/rehearsal-target.mjs";
import { digestBytes, publicWork, databaseTimestamp } from "../media-policy.js";
import { createLiveHTTP } from "./live-http.mjs";
import { syntheticMedia } from "./live-fixtures.mjs";
const ROOT = "memoryTemperature2026";
export async function runLiveTest(
  { config: c, targets },
  http,
  { probeOnly = false } = {},
) {
  assertReadiness(validateLiveConfig(c).targets, targets);
  const report = {
    kind: http.evidence,
    checkedAt: new Date().toISOString(),
    scope: probeOnly ? "preflight-only" : "server-protocol-only",
    overallClassroomReady: false,
    mode: probeOnly ? "read-only-preflight" : "synthetic-test-project",
    targets,
    plans: {
      firebase: c.firebasePlan,
      supabase: c.supabasePlan,
      evidence: "user-console-attestation; not independently measured",
    },
    results: [],
    complete: false,
  };
  const request = async (label, url, options = {}) => {
    const u = new URL(url),
      allowed = [
        targets.databaseHost,
        targets.supabaseHost,
        "identitytoolkit.googleapis.com",
      ];
    if (!allowed.includes(u.hostname))
      throw Error("허용된 테스트 호스트 밖으로 요청하지 않습니다.");
    let r;
    try {
      r = await http.request(u.href, options);
    } catch {
      report.results.push({
        test: label,
        status: null,
        error: "network-or-policy-unavailable",
      });
      throw Error("테스트 연결 실패");
    }
    report.results.push({
      test: label,
      status: r.status,
      uploadedBytes: r.uploaded,
      downloadedBytes: r.downloaded,
      seconds: r.seconds,
    });
    return r;
  };
  const expect = (r, allowed) => {
    if (!allowed.includes(r.status))
      throw Error(
        "예상과 다른 HTTP 상태입니다. 응답 원문은 기록하지 않습니다.",
      );
    return r;
  };
  const db = (segments, token) => {
    const u = new URL(c.firebase.databaseURL);
    u.pathname =
      "/" + [ROOT, ...segments].map(encodeURIComponent).join("/") + ".json";
    if (token) u.searchParams.set("auth", token);
    return u;
  };
  const authURL = (action) =>
    "https://identitytoolkit.googleapis.com/v1/accounts:" +
    action +
    "?key=" +
    encodeURIComponent(c.firebase.apiKey);
  const authHeader = (token) => ({
    Authorization: "Bearer " + token,
    Origin: c.webOrigin,
  });
  const gateway = (action, body, token) =>
    request(action, c.mediaEndpoint, {
      method: "POST",
      headers: authHeader(token),
      json: { action, ...body },
    });
  try {
    const ready = expect(
      await request(
        "gateway-target-preflight",
        c.mediaEndpoint + "?action=readiness",
        { headers: { Origin: c.webOrigin } },
      ),
      [200],
    );
    assertReadiness(targets, ready.json());
    const publicAuth = expect(
      await request(
        "firebase-api-key-target-preflight",
        "https://identitytoolkit.googleapis.com/v1/projects?key=" +
          encodeURIComponent(c.firebase.apiKey),
      ),
      [200],
    );
    assertAuthProject(targets, c.projectNumber, publicAuth.json());
    if (probeOnly) {
      report.complete = true;
      return report;
    }
    expect(
      await request("unauthenticated-upload-denied", c.mediaEndpoint + "?action=upload", {
        method: "POST",
        headers: { Origin: c.webOrigin, "Content-Type": "image/jpeg" },
        bytes: new Uint8Array([255, 216, 255, 0]),
      }),
      [401, 403],
    );
    const media = await syntheticMedia();
    report.fixtureBytes = Object.fromEntries(
      media.map((m) => [m.name, m.bytes.length]),
    );
    const login = async (role, details) => {
      const r = expect(
          await request(
            role + "-auth",
            authURL(details ? "signInWithPassword" : "signUp"),
            {
              method: "POST",
              json: details
                ? {
                    email: details.email,
                    password: details.password,
                    returnSecureToken: true,
                  }
                : { returnSecureToken: true },
            },
          ),
          [200],
        ),
        user = r.json();
      if (
        !user.localId ||
        !user.idToken ||
        (details && user.localId !== details.uid)
      )
        throw Error("가상 계정 UID가 테스트 설정과 일치하지 않습니다.");
      // Check target claims before DB/gateway requests; cryptographic verification remains on Firebase/gateway.
      const claims = JSON.parse(
        Buffer.from(user.idToken.split(".")[1], "base64url"),
      );
      if (
        claims.aud !== targets.firebaseProjectId ||
        claims.iss !==
          "https://securetoken.google.com/" + targets.firebaseProjectId
      )
        throw Error("Firebase 토큰 대상 불일치로 중단합니다.");
      return { uid: user.localId, token: user.idToken };
    };
    const student = await login("student"),
      other = await login("other-student"),
      teacher = await login("approved-teacher", c.teachers.approved),
      unapproved = await login("unapproved-teacher", c.teachers.unapproved);
    const runId = "rehearsal-" + crypto.randomUUID();
    report.runTag = await digestBytes(new TextEncoder().encode(runId));
    const record = {
      schoolId: "S1",
      activityCode: c.activityCodes.S1,
      createdAt: Date.now() - 1000,
      category: "6·25전쟁·호국",
      placeOrigin: "student_suggested",
      placeName: "가상 테스트 장소",
      placeDescription: "실제 학생과 무관한 실연동 검증 자료입니다.",
      address: "가상 주소",
      latitude: 36,
      longitude: 127,
      officialStatus: "not_checked",
      awarenessScore: 1,
      importance: 3,
      visibility: 2,
      scoreReason: "가상 자료를 이용한 서버 검증입니다.",
      sourceType: "나의 판단",
      sourceNote: "실연동 검증 전용",
      rememberSentence: "가상 자료로 접근 권한을 확인합니다.",
      message: "",
      keywords: "가상,테스트",
    };
    expect(
      await request(
        "legacy-new-record-without-awarenessOriginal",
        db(["submissions", "S1", student.uid, runId], student.token),
        { method: "PUT", json: record },
      ),
      [401, 403],
    );
    const newRecord = {
      ...record,
      schemaVersion: 2,
      awarenessOriginal: {
        score: 1,
        capturedAt: record.createdAt - 1000,
        placeName: record.placeName,
        timing: "before-exploration",
      },
    };
    expect(
      await request(
        "new-record-with-awarenessOriginal",
        db(["submissions", "S1", student.uid, runId], student.token),
        { method: "PUT", json: newRecord },
      ),
      [200],
    );
    expect(
      await request(
        "other-student-submission-read-denied",
        db(["submissions", "S1", student.uid, runId], other.token),
      ),
      [401, 403],
    );
    const getWork = (school, id, token) =>
      request("fixture-read", db(["works", school, student.uid, id], token));
    const action = async (school, id, w, status, publicId, patch = {}) => {
      const now = databaseTimestamp(),
        after = {
          ...w,
          ...patch,
          status,
          reviewedBy: teacher.uid,
          reviewedAt: now,
          revision: (w.revision || 0) + 1,
        },
        prefix = `${ROOT}/works/${school}/${student.uid}/${id}`;
      const changes = {};
      for (const k of [
        ...Object.keys(patch),
        "status",
        "reviewedBy",
        "reviewedAt",
        "revision",
      ])
        changes[prefix + "/" + k] = after[k];
      changes[`${ROOT}/publishedWorks/${publicId}`] =
        status === "approved" ? publicWork(after, publicId, now) : null;
      changes[
        `${ROOT}/workAudit/${school}_${student.uid}_${id}/${runId}-${after.revision}`
      ] = { before: w, after, editor: teacher.uid, editedAt: now };
      const u = new URL(c.firebase.databaseURL);
      u.pathname = "/.json";
      u.searchParams.set("auth", teacher.token);
      expect(
        await request("teacher-" + status, u, {
          method: "PATCH",
          json: changes,
        }),
        [200],
      );
      // Resolve server timestamps before this object becomes the next audit "before" snapshot.
      const saved = expect(await getWork(school, id, teacher.token), [200]).json();
      if (saved.status !== status || saved.revision !== after.revision || !Number.isSafeInteger(saved.reviewedAt))
        throw Error("교사 저장 시각/상태 재확인 실패");
      return saved;
    };
    for (let n = 1; n <= 7; n++) {
      const school = "S" + n,
        id = runId + "-" + school,
        original = {
          schoolId: school,
          activityCode: c.activityCodes[school],
          facilityName: "가상 테스트 장소",
          title: "가상 글 작품",
          type: "글",
          introduction: "실제 학생 자료가 없는 연결 검증용 글입니다.",
          entryId: "",
          submissionMode: "text",
        },
        w = {
          ...original,
          studentOriginal: original,
          createdAt: Date.now() - 1000,
          status: "pending",
        };
      expect(
        await request(
          "school-" + school + "-text-create",
          db(["works", school, student.uid, id], student.token),
          { method: "PUT", json: w },
        ),
        [200],
      );
      expect(
        await request(
          "school-" + school + "-same-id-retry",
          db(["works", school, student.uid, id], student.token),
          { method: "PUT", json: w },
        ),
        [200],
      );
      expect(await getWork(school, id, other.token), [401, 403]);
      if (n === 1) {
        const publicId =
          "p_" +
          (await digestBytes(
            new TextEncoder().encode(`${school}_${student.uid}_${id}`),
          ));
        let edited = await action(school, id, w, "pending", publicId, {
          title: "가상 글 수정 검증",
        });
        const saved = expect(await getWork(school, id, teacher.token), [
          200,
        ]).json();
        if (
          JSON.stringify(saved.studentOriginal) !== JSON.stringify(original)
        ) {
          // Firebase REST object property order is not guaranteed.
          if (
            Object.keys(original).some(
              (k) => saved.studentOriginal?.[k] !== original[k],
            )
          )
            throw Error("학생 원본이 바뀌었습니다.");
        }
        edited = await action(school, id, edited, "approved", publicId);
        expect(
          await request(
            "text-approved-projection",
            db(["publishedWorks", publicId]),
          ),
          [200],
        );
        edited = await action(school, id, edited, "archived", publicId);
        edited = await action(school, id, edited, "pending", publicId);
        const auditPath = ["workAudit", `${school}_${student.uid}_${id}`];
        const history = expect(
          await request(
            "teacher-edit-archive-restore-history",
            db(auditPath, teacher.token),
          ),
          [200],
        ).json();
        if (Object.keys(history || {}).length !== 4)
          throw Error("수정/승인/보관/복원 이력을 확인하지 못했습니다.");
        expect(
          await request(
            "student-audit-read-denied",
            db(auditPath, student.token),
          ),
          [401, 403],
        );
      }
    }
    for (const { name, type, bytes } of media) {
      // Genuine synthetic media; the protocol suite still does not claim public-browser playback.
      const school = "S1",
        id = runId + "-" + name,
        asset =
          "p_" +
          (await digestBytes(
            new TextEncoder().encode(`${school}_${student.uid}_${id}`),
          )),
        original = {
          schoolId: school,
          activityCode: c.activityCodes[school],
          facilityName: "가상 테스트 장소",
          title: "가상 " + name + " 프로토콜 작품",
          type: name === "image" ? "사진" : "영상",
          introduction:
            "브라우저 재생 검증과 구분하는 프로토콜 전용 가상 파일입니다.",
          entryId: "",
          submissionMode: "upload",
        };
      let w = {
        ...original,
        studentOriginal: original,
        createdAt: Date.now() - 1000,
        status: "pending",
        mediaProvider: "gateway",
        mediaAssetId: asset,
        contentType: type,
        size: bytes.length,
        sha256: await digestBytes(bytes),
      };
      expect(
        await request(
          name + "-metadata",
          db(["works", school, student.uid, id], student.token),
          { method: "PUT", json: w },
        ),
        [200],
      );
      if (name === "image") {
        const bigId = runId + "-oversize",
          bigAsset =
            "p_" +
            (await digestBytes(
              new TextEncoder().encode(`${school}_${student.uid}_${bigId}`),
            ));
        expect(
          await request(
            "image-size-limit-metadata-denied",
            db(["works", school, student.uid, bigId], student.token),
            {
              method: "PUT",
              json: { ...w, mediaAssetId: bigAsset, size: 3 * 1024 ** 2 + 1 },
            },
          ),
          [401, 403],
        );
        const badId = runId + "-invalid",
          badBytes = Buffer.from("NOT AN IMAGE"),
          badAsset =
            "p_" +
            (await digestBytes(
              new TextEncoder().encode(`${school}_${student.uid}_${badId}`),
            ));
        const bad = {
          ...w,
          mediaAssetId: badAsset,
          size: badBytes.length,
          sha256: await digestBytes(badBytes),
        };
        expect(
          await request(
            "invalid-file-metadata",
            db(["works", school, student.uid, badId], student.token),
            { method: "PUT", json: bad },
          ),
          [200],
        );
        expect(
          await request(
            "invalid-file-signature-denied",
            c.mediaEndpoint + "?action=upload",
            {
              method: "POST",
              headers: {
                ...authHeader(student.token),
                "Content-Type": type,
                "X-School-Id": school,
                "X-Work-Id": badId,
                "X-Activity-Code": encodeURIComponent(c.activityCodes[school]),
              },
              bytes: badBytes,
            },
          ),
          [400],
        );
        await action(school, badId, bad, "rejected", badAsset);
      }
      const upload = () =>
        request(name + "-upload", c.mediaEndpoint + "?action=upload", {
          method: "POST",
          headers: {
            ...authHeader(student.token),
            "Content-Type": type,
            "X-School-Id": school,
            "X-Work-Id": id,
            "X-Activity-Code": encodeURIComponent(c.activityCodes[school]),
          },
          bytes,
          maxSeconds: 90,
        });
      const uploaded = expect(await upload(), [200]);
      if (uploaded.json().state !== "ready")
        throw Error("파일 ready ACK가 없습니다.");
      const retry = expect(await upload(), [200]);
      if (retry.json().duplicate !== true)
        throw Error("동일 파일 재시도의 중복 방지를 확인하지 못했습니다.");
      const location = { schoolId: school, ownerUid: student.uid, workId: id },
        publicURL = c.mediaEndpoint + "?publicId=" + asset;
      expect(await request(name + "-unapproved-public-denied", publicURL), [
        403,
      ]);
      expect(await gateway("preview", location, other.token), [403]);
      expect(await gateway("preview", location, unapproved.token), [403]);
      expect(await gateway("preview", location, teacher.token), [200]);
      w = await action(school, id, w, "approved", asset);
      const publicResult = expect(
        await request(name + "-approved-public", publicURL),
        [200],
      );
      if (!Buffer.from(publicResult.body).equals(bytes))
        throw Error("전송된 파일 바이트가 일치하지 않습니다.");
      const end = Math.min(31, bytes.length - 1);
      const partial = expect(
        await request(name + "-approved-range", publicURL, {
          headers: { Origin: c.webOrigin, Range: `bytes=0-${end}` },
        }),
        [206],
      );
      if (!Buffer.from(partial.body).equals(bytes.subarray(0, end + 1)))
        throw Error("Range 요청의 파일 바이트가 일치하지 않습니다.");
      const pub = expect(
        await request(
          name + "-public-projection",
          db(["publishedWorks", asset]),
        ),
        [200],
      ).json();
      if (
        ["uid", "activityCode", "entryId", "mediaAssetId", "storagePath"].some(
          (k) => Object.hasOwn(pub, k),
        )
      )
        throw Error("공개 사본에 비공개 식별자가 있습니다.");
      w = await action(school, id, w, "private", asset);
      expect(await request(name + "-revoked-public-denied", publicURL), [403]);
      expect(
        await request(name + "-revoked-range-denied", publicURL, {
          headers: { Origin: c.webOrigin, Range: "bytes=0-31" },
        }),
        [403],
      );
    }
    const usage = expect(await gateway("usage", {}, teacher.token), [
      200,
    ]).json();
    report.usage = {
      objectBytes: usage.objectBytes,
      reservedBytes: usage.reservedBytes,
      capacity: usage.capacity,
      estimatedTransferBytes: usage.estimatedTransferBytes,
      transferEstimate: true,
    };
    report.notRun = [
      "public-browser-feed-and-media-playback",
      "browser-mobile-PC-CSV-map",
      "cancel-network-failure",
      "quota-exhaustion",
      "direct-storage-RLS",
      "organization-billing-meter",
      "original-operating-rules",
      "legacy-main-web",
      "official-real-data",
    ];
    report.complete = true;
  } catch {
    report.failure =
      "연결/권한/응답 검증 실패. 마지막 결과 항목을 확인하세요. 원문·토큰은 기록하지 않습니다.";
  }
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (!args.includes("--config") || !args.includes("--report"))
      throw Error(
        "--config PRIVATE.json --report NEW_PRIVATE_REPORT.json을 지정하세요.",
      );
    const input = await readLiveConfig(args[args.indexOf("--config") + 1]),
      out = await privatePath(args[args.indexOf("--report") + 1], {
        existing: false,
      });
    // Reserve the result before any network/mutation; never run and then discover a report overwrite.
    const handle = await open(out, "wx", 0o600);
    try {
      const report = await runLiveTest(input, createLiveHTTP(), {
        probeOnly: args.includes("--probe-only"),
      });
      await handle.writeFile(JSON.stringify(report, null, 2) + "\n");
      console.log(
        JSON.stringify({
          kind: report.kind,
          complete: report.complete,
          requests: report.results.length,
          report: out,
        }),
      );
      if (!report.complete) process.exitCode = 2;
    } finally {
      await handle.close();
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
