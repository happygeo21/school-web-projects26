# 배포 및 검증 기록 · 2026-10-21

## 현재 운영 결정

사용자는 Firebase 공동 저장만 우선 사용하기로 선택했다. Spark 요금제를 유지하고 Blaze 결제 연결과 Cloud Functions 배포는 보류한다. Notion 전용 연결 생성은 완료했으나 자동 전송은 비활성 상태다.

노션 토큰의 Secret Manager 등록과 API 활성화/약관 동의는 승인받았다. 실제 콘솔에서 Secret Manager API가 결제 계정이 연결된 프로젝트를 요구하는 것을 확인해 결제 연결을 취소했다. 따라서 토큰은 읽거나 복사하지 않았고 비밀 저장소 등록은 미완료다. 추가 승인을 기다리는 상태가 아니라 현재 무과금 운영 선택에 따른 보류다.

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

현재 `cloudConfig`는 실제 프로젝트를 사용하고 `notionEnabled=false`로 서버 전송만 비활성화했다.

## Notion 서버 연동

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
- 미완료: 두 번째 계정 소유자의 실제 로그인, 실제 오프라인 저장 시험, 운영 Notion 서버 전송. 모든 Rules 입력 조합을 망라한 검사는 수행하지 않았다. 준비 코드와 실제 검증 결과를 구분한다.

공식 참고: [Firebase Auth와 Rules](https://firebase.google.com/docs/rules/rules-and-auth), [Cloud Functions 시작](https://firebase.google.com/docs/functions/get-started), [Notion 페이지 생성](https://developers.notion.com/reference/post-page).
