> 무료 미디어 후속 구현은 [MEDIA-IMPLEMENTATION.md](MEDIA-IMPLEMENTATION.md)를 우선 확인하세요. 실제 Firebase/Supabase 연동은 미완료이며 아래는 이전 시점의 검토 기록입니다. 운영 설정·승인 조건은 유지합니다.

# PR #7 최종 검토 — 운영 전환 보류

> 후속 정리(2026-10-29 KST): [교사용 운영 자료 수집표](OPERATIONS-INPUT-CHECKLIST.md)에 확인 화면·비공개 전달 범위·401 판별·테스트 연결·awarenessOriginal 충돌 실측 계획을 모았습니다. 원문/테스트 프로젝트/preview 설정은 **사용자 확인 필요**입니다. 이번에는 기능을 추가하지 않으며 아래 검증 이력의 범위를 확대해 주장하지 않습니다.

## PR 메타데이터와 범위

새 PR을 만들지 않습니다. 대상은 https://github.com/happygeo21/school-web-projects26/pull/7 입니다. 검토 시작 head `ac68ba7bdca90ee18702c4eb29509615da82eb55`는 main 대비 6개 커밋·31개 파일이며 main은 `c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5`입니다. 작업 도중 정적 점검 도구/문서가 추가되어 최종 head와 수는 최종 보고·PR 화면을 기준으로 합니다.

현재 GitHub 웹 화면의 PR 상태 라벨에서 **Draft**를 확인했습니다. 사용자 전달 당시 Open/비-Draft라는 상태와 달랐습니다. `gh pr ready 7 --undo`는 GraphQL Forbidden으로 실패했으므로 이 상태를 이 작업의 변경 성공으로 기록하지 않습니다. 제목/본문 변경도 API Forbidden으로 실패했습니다. 새 제목은 아래와 같고 실제 본문 대체안은 [PR7-BODY.md](PR7-BODY.md)에 준비했습니다. **아직 PR에 반영됐다고 주장하지 않습니다.**

`기억의 좌표 LIVE | 학생·교사·공개용 개선 및 안전 전환 준비`

로그인한 GitHub에서 PR #7 → 제목 옆 Edit → 제목 저장 → 첫 본문 ⋯/Edit → PR7-BODY.md 내용 붙여넣기 → Update comment를 누릅니다. Draft라면 Ready for review를 누르지 않습니다. Open이라면 우측 Reviewers 근처 Convert to draft → 확인을 사용합니다. Merge/auto-merge는 누르지 않습니다. 이 작업은 PR 설명 편집이며 다른 사람에게 별도 메시지를 보내는 작업이 아닙니다.

## 1. Netlify Deploy Preview — 실제 읽기 전용 검사

대상:
- https://deploy-preview-7--veteransgeo.netlify.app
- https://deploy-preview-7--happygeo.netlify.app

현재 머신에서는 두 호스트가 프록시 CONNECT 403으로 차단됐습니다. 대안으로 [정적 점검 CI](https://github.com/happygeo21/school-web-projects26/actions/runs/40811396395)를 실행했고, 공개 요약의 annotation에서 **두 홈/설정 GET 모두 HTTP 401**임을 확인했습니다. workflow Success는 감사 스크립트가 완료됐다는 뜻이며 사이트 안전 판정 성공이 아닙니다.

| 항목 | 판정 |
|---|---|
| 인증 없는 미리보기 접근 | 401로 차단됨 |
| 실제 배포된 Firebase projectId/databaseURL | 보호 화면 뒤라 읽지 못함. 저장소 양쪽 설정은 운영 school-project-26-1edf4를 가리킴 |
| 실제 학생 자료 접근 | 요청하지 않음. 실제 권한은 확인하지 않음 |
| DB/Storage 쓰기 테스트 | 하지 않음. 익명 로그인·교사 로그인도 실행하지 않음 |
| Auth 승인 도메인 | public Auth 설정 GET을 설계했지만 웹 설정을 못 읽어 실행 불가. Console 확인 필요 |
| security/ 노출 | 현재는 인증 게이트가 401로 막음. 로그인 후 경로가 404인지 확인하지 못함 |
| production 배포 | preview와 구분. 이번 작업에서 변경/검증하지 않음 |
| happygeo 영향 | main 대비 happygeo 소스·Netlify 설정 변경 없음. 동일 Firebase 프로젝트의 다른 루트 보존 필요 |

점검 도구는 JS를 실행하지 않는 정적 GET만 수행하고 키/토큰/응답 원문을 출력하지 않습니다. RTDB/Storage·학생 기록·사용자 인증 API를 호출하지 않습니다. Firebase SDK의 공개 프로젝트 설정 조회만 선택적으로 설계했습니다. 설정 파일이 401이어서 그 조회도 불가능했습니다.

**안전 지침:** 실제 설정을 확인하기 전까지 두 preview를 운영 Firebase 연결 가능 상태로 취급합니다. 학생 페이지는 열기만 해도 코드가 익명 인증을 시작할 수 있고, 공개 페이지는 approved 자료 구독을 시작할 수 있습니다. 무심코 브라우저 기능 테스트를 실행하지 않습니다. 승인 도메인이 빠져 Google 로그인이 막히더라도 익명/DB 권한의 안전 장치로 간주하면 안 됩니다.

### 별도 테스트 Firebase 연결 설계 (이번에 적용하지 않음)

1. Netlify에서 기존 preview 접근 보호를 유지합니다. 이미 생성된 preview는 새 빌드를 멈춘 것만으로 철회되지 않으므로 기존 URL 접근도 별도로 관리합니다.
2. 별도 Spark 테스트 프로젝트와 가상 승인/미승인 교사·학생 계정을 준비합니다. 운영 데이터를 복사하지 않습니다. 프로젝트가 없으면 운영 DB를 대체재로 쓰지 않습니다.
3. Netlify 프로젝트 → Project configuration → Environment variables에서 **Deploy Previews context에만** Web 설정을 지정합니다. production context는 유지합니다. vets/happygeo 두 사이트별로 분리해야 합니다.
4. 향후 검토할 빌드 검증은 CONTEXT=deploy-preview에서 테스트 설정이 없거나 projectId/DB 호스트가 운영과 같으면 실패하도록 합니다. 실패 후에도 이전 preview가 남을 수 있으므로 1번 접근 제한을 해제하지 않습니다. 운영 설정으로 자동 fallback하지 않습니다.
5. vets 설정은 ESM export, happygeo는 window 설정이므로 단일 파일을 무조건 덮어쓰지 않습니다. 기존 loader/루트·앱 동작을 보존한 별도 빌드 오버레이를 검토합니다. 이번에는 다른 앱 파일을 수정하지 않았습니다.
6. Firebase Web 설정은 브라우저에서 보이는 설정이며 서비스 계정/관리자 키를 넣으면 안 됩니다. 값은 공개 저장소에 커밋하지 않습니다. 보안은 테스트 Rules와 승인 계정에 둡니다.
7. 테스트 프로젝트의 Auth 승인 도메인과 7학교/교사/작품 리허설을 검증한 뒤 preview 공유를 허용합니다.

## 2. 기존/신규 데이터·Rules 호환성

main 학생의 20개 필드:
`createdAt,schoolId,activityCode,category,placeOrigin,placeName,placeDescription,address,latitude,longitude,officialStatus,awarenessScore,importance,visibility,scoreReason,sourceType,sourceNote,rememberSentence,message,keywords`.

신규 코드는 위 필드를 유지하고 `schemaVersion,awarenessOriginal,facilityId`를 추가합니다. 교사 수정 후 `revision,updatedBy,updatedAt` 및 보관 시 `deletedAt,deletedBy`가 추가됩니다. awarenessOriginal은 탐색 전 값/시각/당시 장소명/시점을 보존하며 기존 기록에 없던 원자료를 만들어 채우지 않습니다.

| 조합 | 확인 결과 |
|---|---|
| 기존 웹 + 기존 운영 Rules | 실제 전체 원문 미제공. 화면 일부만으로 실제 성공을 보장하지 않음 |
| 기존 웹 + 신규 strict 후보 | 신규 생성은 awarenessOriginal 누락으로 거부됨. 실제 학생에게 먼저 적용하면 안 됨 |
| 신규 웹 + 기존 운영 Rules | 공통 필드는 유지하지만 추가 필드·works/audit 등의 허용 여부는 원문 없어서 미확정 |
| 신규 웹 + 신규 후보/합성 이메일 병합본 | 기존 CI의 가상 계정 Emulator에서 검증. 실제 운영 승인 목록/전체 루트 검증은 아님 |
| 기존 레거시 기록 + 신규 후보 | teacher 읽기·원인지도 보존 설계. 실제 기존 데이터 복사 없이 같은 형태의 가상 기록으로 추가 실측 필요 |

실제 기존 Rules 원본을 생성하거나 가상의 원문을 실제 원문으로 표현하지 않았습니다. 현재 원문은 저장소 밖 비공개 경로로 제공되어야 하며, 다른 앱 루트/상위 권한/경로별 승인 계정을 비교한 다음에만 실제 후보를 만들 수 있습니다.

### 보안 유지형 과도기 호환 규칙 우선 검토

가능한 부분적 bridge는 학생 본인 UID·유효 학교의 **최초 생성 및 완전히 동일한 재시도만** 허용하고 기존 20개 필드의 타입/범위 검증을 유지하는 것입니다. legacy 기록에는 과거 인지도를 소급 생성하지 않으며 미측정으로 구별해야 합니다. 새 읽기 권한·타 학생 수정·임의 덮어쓰기를 주지 않습니다. 별도 승인된 서버 만료 시각으로 한시 허용하는 방안을 검토할 수 있습니다.

그러나 클라이언트는 버전 필드를 생략해 legacy인 척할 수 있어, bridge 기간의 기록을 검증된 신규 사전 측정과 섞으면 안 됩니다. 현재 통계/연구 분류의 추가 검토가 필요합니다. 또한 기존 교사 코드는 UID 포함 공개 키를 쓰고 물리 삭제를 요청합니다. 그 동작까지 허용하면 공개 비식별화·원본 보존 정책을 약화시킵니다.

따라서 실제 원문·연구 구분·기간·교사 전환이 없는 상태에서 “완전 호환 bridge”를 게시하지 않습니다. 학생 일부 호환만으로 전체 전환 가능 판정을 하지 않고, 현재 권장안은 [RELEASE-PREFLIGHT.md](RELEASE-PREFLIGHT.md)의 **수업 외 동시 점검 전환**입니다. claim 도입 대신 기존 이메일 승인을 우선 보존합니다.

## 3. 기능 적합성·공식 자료

기존 core/브라우저 대역/두 역할 방식 Emulator 결과는 REVIEW.md와 CI를 활용합니다. 실제 Firebase의 인증·운영 권한·실제 링크 접근을 완료로 표시하지 않습니다. 별도 테스트 프로젝트 실측은 아직 계획입니다. 운영 DB에 테스트 레코드를 쓰지 않습니다.

공식 API와 안내 페이지에 다시 HTTPS 요청했지만 프록시 403입니다. 공식 캐시는 빈 상태 그대로입니다. [FACILITY-IMPORT.md](FACILITY-IMPORT.md)에 따라 공식 문서에서 제공하는 다운로드/재배포 가능한 자료를 받거나 국가보훈부 공식 문의 경로로 JSON/CSV·좌표 명세·이용 조건을 요청합니다. 주소만 확인된 문서나 일반 지도 검색 결과로 지정 상태/좌표를 만들어 넣지 않습니다. 기관 파일의 출처·갱신일·CRS/축·공식 지도 대조를 확인한 뒤 기존 importer로 검토 후보를 만들고 별도 코드 리뷰합니다.

## 4. A/B/C/D와 수업 판정

| 구분 | 상태 |
|---|---|
| A. 현재 운영 유지 대상 | main의 기존 3페이지·3단계·7학교·CSV. 실제 production 접속/저장 성공은 이번 작업에서 검증하지 못함 |
| B. 개발·격리 검증 완료, production 미적용 | 초안/동일 ID 복구, 오류 분류, 수정/이력/보관·복원 UI, 작품·공개 갤러리, CSV·모바일. 브라우저는 SDK 대역/가상 계정이고 운영 실사용 확인과 다름 |
| C. Rules 적용·별도 실측 후 가능 | 서버 소유권/원인지도/중복 방지 강제, 교사 수정/승인, works/audit/workAudit/publishedWorks의 실제 저장·조회 |
| D. 보류 | 공식 시설 실데이터, 실제 운영 병합본/Auth/Netlify 설정, 별도 테스트 프로젝트 실측, Storage 파일 직접 업로드·비용·버킷 검증 |

**학생 수업 적용 판정: 이 PR의 신규 기능 운영 적용은 보류.** 기존 수동 탐구/기록지 활동과 검토 환경 리허설은 별도로 진행할 수 있습니다.

필수 문제 3개:
1. 두 preview의 로그인 뒤 실제 Firebase 연결과 Auth 설정을 확인하고 테스트 백엔드로 격리할 때까지 쓰기/로그인 기능 테스트 금지.
2. 전체 운영 Rules 원본 백업 → 기존 이메일 계정·다른 앱 루트 보존 → 실제 호환 후보 검증.
3. 별도 테스트 프로젝트에서 7학교·교사 수정/복원/승인·작품·모바일·CSV를 실측하고 두 운영 사이트의 버전/복구 지점을 확정.

## 5. 교사가 직접 할 순서

### GitHub → Firebase → Netlify

1. GitHub PR #7 → 제목 Edit 및 첫 본문 Edit → 준비된 제목/PR7-BODY.md 반영 → Update comment. 현재 Draft를 유지하고 Ready for review/Merge/auto-merge는 누르지 않습니다.
2. Files changed에서 happygeo 소스 변경 없음과 배포 경계를 확인하고 Checks의 커밋별 검사 결과를 확인합니다. Deploy Preview success와 production 성공을 구분합니다.
3. Firebase Console → 프로젝트 ID 확인 → Realtime Database → 올바른 인스턴스 → Rules → **게시된 전체** 원문을 저장소 밖 비공개 백업. 편집 중 버전과 구분하며 Publish는 누르지 않습니다.
4. Authentication → Sign-in method 및 Settings → Authorized domains 확인. 기존 승인 교사 목록은 비공개 보존하며 계정을 무단 추가/삭제하지 않습니다. Usage and billing은 Spark 유지, Storage 업그레이드는 하지 않습니다.
5. Netlify → 각 프로젝트 → Deploys → PR #7 Deploy Preview → Deploy file browser에서 firebase-config.js를 **정적 파일로** 확인하고 projectId/DB 호스트만 기록합니다. 키 원문을 공유하지 않습니다. 학생 페이지 자체를 실행해 확인하지 않습니다.
6. 같은 file browser에서 security/·Rules·package 파일이 실제 artifact에서 제외됐는지 확인합니다. 현재 401 뒤의 404는 에이전트가 검증하지 못했습니다.
7. Project configuration → Environment variables에서 preview/production scope 확인 → Domains에서 기존 운영 주소 확인 → Build & deploy에서 base/build/publish/production branch/Published deploy ID 기록. 접근 보호는 유지하고 다른 앱 프로젝트 설정은 바꾸지 않습니다.
8. 별도 테스트 프로젝트 실측과 백업/복구 계획이 완성되면 **별도 운영 전환 승인**을 요청합니다. 그전에는 여기서 중지합니다.

### 승인 후 전환/복구 계획 (실행하지 않음)

양쪽 사이트의 제출/교사 승인을 점검 시간 동안 중지 → 원본 전체 Rules 해시와 이전 Pages 커밋/Netlify Published ID 확보 → 실제 이메일 승인식 병합 후보 검증 → 승인받은 Rules와 웹 코드를 같은 점검 시간에 전환 → 두 기존 주소·교사 권한·개발 파일 제외를 독립 확인 → 수업 재개.

main 병합은 Pages 자동 배포를 시작할 수 있습니다. Rules-first 상태에서 구형 학생 페이지가 살아 있거나 코드-first 상태에서 신규 경로가 차단되는 시간을 실제 수업에 노출하지 않습니다. 다른 Netlify 프로젝트의 main-trigger 영향도 확인합니다.

실패하면 점검 유지 → 이전 웹과 해당 앱의 이전 Rules를 함께 복구 → 기존 자료/교사 권한 확인. 그동안 다른 앱의 Rules가 바뀌었으면 전체 과거 파일을 덮어쓰지 말고 최신 다른 루트·전역 권한을 보존해 해당 앱만 복구합니다. 데이터 삭제/리셋·main force push는 하지 않습니다. 보관 상태와 신규 이력은 보존합니다. 상세 체크리스트는 RELEASE-PREFLIGHT.md를 따릅니다.

## 6. 수행하지 않은 작업

main 병합, 운영 Rules 게시, 실제 학생 자료 읽기/변경/삭제, 운영 DB 쓰기 테스트, Netlify production 배포 변경, Blaze/Storage 변경, 교사 승인 계정 변경, API 키/교사 이메일 원문의 신규 공개 저장소 업로드, 새 PR 생성, Notion 외부 쓰기를 하지 않았습니다.

Notion 추가 문안: “PR #7 최종 검토 / preview 정적 GET 모두 401로 실제 백엔드 미확정 / 저장소 설정은 운영 Firebase이므로 테스트 금지 / 전체 Rules·별도 테스트 프로젝트·Netlify 설정 확인 대기 / PR 제목·본문 대체안 준비, API 편집 Forbidden / 운영 적용 보류 / main·운영 DB·Rules·production 배포 변경 없음”.
