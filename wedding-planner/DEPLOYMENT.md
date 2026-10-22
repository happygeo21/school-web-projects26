# 배포 및 검증 기록 · 2026-10-21

## 금액 반영 및 준비 분야 확장

- 기존 Wedding Journal에 원화 숫자 속성 관련 금액, 금액 구분(미분류/예상/견적/계약금액/실제지출), 예정일을 추가했다. 기존 분야·상태·행·수동 메모는 보존했다.
- 웹앱을 가족 식사·웨딩스냅·신혼집 구매의 세 입구로 정리하고 관련 기록 필터, 금액 구분, 다음 행동, 예정일을 추가했다. Firestore는 기존 회원 제한과 revision 검사를 유지하면서 새 선택 필드만 허용하도록 실제 규칙을 게시했다.
- Worker 매핑 버전 2는 관련 금액과 새 준비 항목을 전송한다. 과거 전송 이력은 pageId를 유지한 PATCH로 보완하고, 같은 버전·같은 매핑의 중복 전송은 차단한다. 기존 기록에 없는 다음 행동·예정일은 노션의 수동 값을 덮어쓰지 않는다.
- 운영 웹에서 기존 사용자 시험 기록을 원본 수정 없이 재전송해 동일 노션 페이지의 금액이 채워짐을 확인했다. 별도의 기존 연결 확인 기록으로 금액 구분·다음 행동·예정일·웨딩 촬영 분류를 실제 저장·전송했고, 노션 조회와 실제 UI의 원화 표시를 확인했다. 시험 금액·일정은 확인 후 비웠고 노션의 0원·미분류·예정일 비움도 확인했다.
- 노션 허브·식사 실행계획·기존 신혼집 의사결정·중간보고를 범위에 맞게 업데이트했다. 웨딩스냅 준비 페이지를 허브 하위에 만들고 공통 DB의 분야별 보기를 연결했다. 식사·스냅·신혼집·금액·다음 할 일 탭을 추가하고 기존 전체/최신 보기에 새 속성을 표시했다.
- 매핑·기존 전송 보완을 포함한 Worker 검사 10개 통과. 무료 요금제·전송 제한·비밀키 저장 위치는 유지했다. 기존 학교용 파일과 Firebase 프로젝트는 수정하지 않았다.

## 현재 운영 결정

사용자는 비용이 발생하지 않는 두 번째 방식으로 변경하도록 승인했다. Firebase Spark 공동 저장을 유지하고 Cloudflare Workers Free의 `wedding-notion-private-sync`로 노션 전송을 연결한다. Google 결제 계정과 Blaze·Cloud Functions·Secret Manager는 사용하지 않는다. 전송은 선택한 기록의 버튼으로 실행하는 단방향 방식이다.

이전 Secret Manager 시도는 결제 계정 요구로 중단했다. 이후 별도로 Cloudflare 공식 배포 권한과 전용 서버 비밀 환경변수 저장을 승인받았다. 현재 전용 노션 토큰은 Cloudflare `WEDDING_NOTION_TOKEN` Secret에 암호화 저장하고 배포했다. 원문은 채팅·GitHub·노션 본문·로그·로컬 파일에 저장하지 않았다.

## 실제 설정한 항목

- 기존 Pages 경로 `/school-web-projects26/wedding-planner/` 유지.
- Firebase 독립 프로젝트 `our-wedding-planner-5baf7` 생성. 학교 프로젝트와 데이터 분리.
- Firebase Web 앱 `Wedding Planner Web` 등록.
- Firestore Standard `(default)` 생성, `asia-northeast3` (서울).
- 프로덕션 잠금 모드에서 시작한 뒤 `firestore.rules`와 동등한 회원 제한 규칙 게시 성공 확인.
- 익명 Firestore records 조회: 실제 HTTP 403 확인.
- 사용자 명시 승인 후 Google 로그인 제공업체 저장. `happygeo21.github.io` 승인 도메인 등록.
- 두 Google 이메일을 비공개 Firestore `access/config` 문서에 등록. 이메일은 코드·문서·로그에 저장하지 않음.
- 실제 Google 로그인, records 생성/수정, 별도 로그인 세션 조회 성공. 같은 revision을 수정한 두 화면 중 늦은 저장은 충돌 안내와 함께 거부. 로그아웃 후 기록/입력란 제거 및 저장/백업 비활성 확인.
- 규칙 시뮬레이터: 두 번째 허용 이메일 읽기 허용, 목록 밖 가상 이메일 읽기 거부. 실제 두 번째 소유자의 Google 로그인은 본인이 수행해야 함.
- 현재 규칙에서 비로그인 access/config 및 records 조회 모두 실제 HTTP 403.
- 선택적 Gemini, Google Analytics 미사용. Spark 무료 요금제 유지.

## 현재 접근 제어

1. Rules는 Google 제공업체 로그인, 이메일 인증 완료, 비공개 허용 목록 포함을 모두 요구한다. 브라우저에서 이메일을 입력한다고 권한이 생기지 않는다.
2. `access/config`의 `emails` 배열에는 승인받은 두 계정만 저장했다. 목록의 읽기도 회원만 가능하며 클라이언트 쓰기는 금지한다. 변경은 관리자 콘솔에서만 수행한다.
3. 앱과 노션 전송 함수가 같은 접근 목록을 검사한다. 초기 준비 코드의 UID별 `members` 경로는 사용하지 않는다.
4. Firebase Web 공개 식별자는 `cloud-config.js`에 설정했다. 실제 보안 경계는 Rules다. 서비스 계정 키는 사용하지 않는다.
5. 첫 번째 소유자의 두 로그인 세션에서 연결·저장·수정·충돌·로그아웃을 실제 검증했다. 두 번째 소유자의 실제 로그인 및 실제 기기에서의 최종 사용 확인은 남아 있다.

Web 앱 식별자: `1:499305995229:web:8ae8f00c41b34849cfb434`. Firebase Console 프로젝트 설정에서 공개 설정 객체 전체를 확인한다.

현재 `cloudConfig`는 실제 프로젝트를 사용한다. `notionEndpoint`는 `https://wedding-notion-private-sync.ksoundmin.workers.dev/export`이며 `notionEnabled=true`로 실제 전송을 사용한다.

## Cloudflare 무료 Notion 전송 (현재)

- Workers 대시보드에서 무료 일일 요청 100,000회, 기존 Worker와 새 Worker가 각각 존재함을 확인했다. 기존 학교용 Worker는 변경하지 않았다.
- SQLite Durable Object를 바인딩해 전송 상태와 중복 방지 이력을 직렬화한다. 본문·이메일·토큰은 저장하지 않는다.
- 실제 서버에서 비로그인 401, 잘못된 인증 401, 다른 Origin 403 확인.
- 운영 Pages에서 실제 Google 로그인 → 기존 개인정보 없는 시험 기록 저장 → 노션 생성 성공 확인. 같은 버전 다시 전송 시 `already-sent` 안내로 중복 차단. 기록 수정 후 다시 전송해 동일 Notion 페이지가 갱신됨을 별도 Notion 커넥터 조회로 확인. 해당 제목 접두어 SQL 결과는 1건, page ID는 `400abbdc-ebdc-81cc-9281-f4dab369c236`로 유지됐다.
- 실제 무료 한도를 소진하는 검사는 하지 않았다. 일일 200회/6초 간격/UTC 초기화는 모의 테스트로 검증했다. 두 번째 계정 실제 로그인은 여전히 소유자 확인이 필요하다.
- 모의 테스트 10개 통과: 접근 차단, 동시 중복 방지/수정 PATCH, stale revision, 불확실 응답 잠금, 일일 200회/6초 간격/초기화, 무료 한도 및 서버 오류, CORS, 긴 Unicode 매핑.
- 상세 제한·복구·배포는 [worker/README.md](worker/README.md). 한도 도달 시 중단하며 유료 플랜으로 전환하는 코드는 없다.

## Cloud Functions 준비 코드 (미사용 이력)

아래는 이전 유료 서버 방식의 준비 이력이다. 현재 배포 대상으로 사용하지 않는다. 실제 운영 서버와 비밀키는 위 Cloudflare 방식이다.

- 연결된 ChatGPT Notion 플러그인 권한은 자체 서버 토큰이 아니다. 토큰을 추출하거나 재사용하지 않는다.
- 사용자 승인 후 `Wedding Planner · Private Sync` 전용 integration을 생성했다. 기존 Wedding Journal DB만 수동 선택해 연결했으며 개인 사용자 정보·댓글·에이전트 기능은 사용하지 않는다. 토큰은 Google Secret Manager의 `WEDDING_NOTION_TOKEN`에 등록할 예정이며 현재 등록 승인/배포 대기다. 채팅·GitHub·페이지 본문에 붙여넣지 않는다.
- Cloud Functions 운영 배포에는 Blaze 결제 연결이 필요하다. 현재 미승인·미배포. 과금 연결은 사용자가 직접 수행한다.
- `functions/index.cjs`의 `exportWeddingRecord`는 회원 인증 및 서버의 현재 revision을 검사하고 기존 DB 스키마에 맞춰 전송한다. Firebase → Notion 명시적 단방향 전송이며 노션에서 한 수정은 역동기화하지 않는다.
- 전송 완료 후 기록 ID별 Notion page ID를 서버 전용 `notionSync`에 보관한다. 같은 revision 재전송은 무시하고 이후 revision은 같은 페이지를 갱신한다.
- 전송 결과가 불명확하면 `uncertain` 상태로 자동 재시도를 차단한다. 관리자가 노션에 생성된 페이지를 조회해 pageId/상태를 복구한 후 다시 시도한다. 이 설계는 불명확한 네트워크 응답에서 중복 페이지를 자동 생성하지 않는다.
- `functions/pnpm-lock.yaml`로 의존성을 고정했다. Cloud Functions 실행 대상 Node 22; 로컬 구문/매핑 테스트는 제공된 Node 24에서 수행했다.
- 배포 예: functions 폴더에서 `pnpm install --frozen-lockfile`, 플래너 폴더에서 `firebase functions:secrets:set WEDDING_NOTION_TOKEN`, `firebase deploy --only functions:wedding`. 콘솔에 인증된 전용 계정과 승인된 결제 설정이 필요하다.
- 실제 서버 왕복 및 중복 전송 테스트가 통과한 후에만 `notionEnabled=true`로 변경한다.

## 데이터 보안 및 기존 데이터

- 웹 프로그램과 준비 조건은 공개; 개인 공동 기록은 Firestore 회원 제한. UI에만 숨기는 방식이 아니다.
- 서버 규칙에서 허용 필드·최대 길이·범주·상태·금액 범위·서버 시간·수정 revision 검증. 클라이언트 회원 추가와 기록 영구삭제 차단.
- 새 앱은 인증 및 Firestore 데이터를 메모리에만 유지. 로그인 계정/기록을 localStorage에 저장하지 않음. 백업 다운로드는 별도 확인 후 실행.
- `guide.html`은 기존 앱을 보존하며 기존 localStorage 키를 그대로 읽는다. 이전 예산·체크리스트·메모는 여기서 백업할 수 있다. 새 공동 기록으로 자동 이전하지 않는다.
- 기존 계산기의 localStorage는 로그아웃 기능과 독립적으로 남는다. 공용 기기에서 사용하지 않고 백업 후 사이트 데이터를 직접 정리한다. 새 앱의 로그아웃이 기존 계산기 저장소까지 지웠다고 표시하지 않는다.
- 공개 저장소 이력에서 기존 공개 안내를 완전히 제거한 것은 아니다. 노션 공유/웹 게시 권한은 별도로 확인해야 한다.

## 검증 범위

- 완료: 정적 화면/모바일/메뉴, Google 실제 로그인, Firebase 실제 생성/수정, 두 세션 반영, 오래된 revision 저장 충돌 차단, 로그아웃 시 데이터 제거, 비로그인 저장/백업 비활성화, 구문 검사, Notion 매핑/긴 텍스트 분할 2개 테스트, 익명 서버 접근 거부 및 두 번째 허용 이메일/목록 밖 이메일의 규칙 시뮬레이션.
- 현재 추가 완료: Cloudflare 무료 서버와 암호화 비밀키 등록, 실제 Notion 생성·중복 차단·동일 페이지 수정 반영, 비로그인/잘못된 인증/다른 Origin 서버 거부, Worker 모의 테스트 10개.
- 미완료: 두 번째 계정 소유자의 실제 로그인, 실제 오프라인 저장 시험, 실제 한도 소진 시험. 모든 Rules 입력 조합을 망라한 검사는 수행하지 않았다. 준비 코드와 실제 검증 결과를 구분한다.

공식 참고: [Firebase Auth와 Rules](https://firebase.google.com/docs/rules/rules-and-auth), [Cloud Functions 시작](https://firebase.google.com/docs/functions/get-started), [Notion 페이지 생성](https://developers.notion.com/reference/post-page).


## 2026-10-22 · Private attachments

Record files use the existing authorized Notion Journal via the existing Worker. No Firebase Storage, billing account, additional secret, membership change or Firestore schema change is required. Text stays in Firestore; file bytes stay in Notion. The Durable Object keeps filenames, sizes, MIME types and block/operation IDs, never file bytes, signed URLs or credentials. Photos are re-encoded in the browser (maximum 2048px long edge) before upload; original photo metadata is not copied. Documents retain original bytes.

The three POST routes `/attachments/list`, `/attachments/upload` and `/attachments/download` enforce the exact CORS origin and Firebase token shape; every operation subsequently checks the same token against the source Firestore record. Downloads require a block ID in that record's private manifest, a matching Notion parent and a Notion-hosted S3 file. No signed storage URL is exposed or persisted. Executable/HTML/SVG/archive uploads are excluded; content signatures and byte limits are checked on the server. This does not constitute antivirus scanning of documents.

Hard application limits: 5,000,000 bytes/file, 3 selected files/batch, 20 files/record, 40 upload attempts and 500 file opens per UTC day (09:00 KST reset). Existing record export limits remain separate. Uploaded blocks are appended; normal text exports preserve existing files. Successful operation IDs prevent repeat attachment; an ambiguous block append remains blocked to avoid duplicates. Check Notion before retrying an uncertain attachment with a new selection. If text saves but file upload fails, the UI keeps unsent files in memory and clearly reports partial success. Logout clears selections, previews and pending requests. JSON record backups exclude binary file bodies. Notion's existing page sharing permissions still apply; no sharing changes are made.

References: https://developers.notion.com/guides/data-apis/uploading-small-files and https://developers.notion.com/guides/data-apis/working-with-files-and-media . HWP/HWPX are not accepted by this workflow; export to PDF first.
