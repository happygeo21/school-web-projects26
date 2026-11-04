# GeoTeacher 3.2 운영 적용 준비 결과

기준일: 2026-11-04 KST. **운영 소스·설정과 D1 읽기 조회는 완료했으며, 실제 배포는 인증 준비와 별도 승인까지 보류한다.** 이 문서의 신규 결과가 이전 인계 문서의 'Cloudflare 접근 미확인' 상태를 갱신한다. 새 봇·유료 플랜·AI API는 추가하지 않았다.

> 후속 상태: PR #16은 main `4d1746fdd82409a7d8a30287e94856f087e84cdc`에 2026-11-04 11:55:23 KST 병합되었다. [D1 실행 41769237145](https://github.com/happygeo21/school-web-projects26/actions/runs/41769237145)에서 승인 보호 통과, 원격 SQL 적용과 13:09:56 KST 구조 검증 성공을 확인했다. **D1을 재생성하거나 마이그레이션을 반복하지 않는다.** 아래의 D1 미적용·PR 미병합·승인 환경 404 기록은 초기 점검 당시 상태다. 현재 남은 후보 준비 절차는 [SECRET_STAGING_PLAN.md](SECRET_STAGING_PLAN.md)를 따른다.

## 실제 조회 결과

GitHub Actions [운영 비교 실행](https://github.com/happygeo21/school-web-projects26/actions/runs/41736045856)에서 기존 읽기 토큰을 사용했다. 소스·설정 원문, Secret 값, 학생/업무 행을 로그나 artifact에 저장하지 않았다. artifact에는 해시·일치 여부·알려진 바인딩 이름과 유형·DB 구조 판정만 포함한다.

| 항목 | 확인 결과 |
|---|---|
| 현재 main | `e53f9288b02d794dd2b43197b1df621d0954e388` (PR #17 병합) |
| 운영 배포 ID | `d6e643fc-dedb-4f07-95da-c343d1dd9518` |
| 활성 버전 | `682b662b-2da1-4c0f-af5e-86c9bfd5e78a`, 트래픽 100% |
| 운영 소스 | 1개 모듈, 11,117바이트. main의 `src/index.js`와 줄바꿈·파일 앞뒤 공백을 제외하면 일치 |
| 운영 소스 SHA-256 | `19970a2b90260a69ab4f942898f3db8973477fe7ad2b6c3eea04fb96e14c2a2e` |
| 기존 Secret | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `NOTION_API_TOKEN`, 모두 secret_text. 값은 조회·출력하지 않음 |
| 기타 바인딩 | 없음. `TASK_DB`, `NOTION_WRITE_TOKEN`은 아직 없음 |
| 호환성 날짜 | `2026-11-03`, 별도 호환성 플래그 없음 |
| 공개 운영 주소 | workers.dev 활성, 버전 preview URL 비활성 |
| 관측 설정 | enabled=true, head_sampling_rate=1; logs enabled=true, invocation_logs=true, head_sampling_rate=1 |
| 원복 후보 | 활성 버전 상세 조회 가능, 최근 100개 버전 이력 안에 존재. 실제 원복은 실행하지 않음 |
| 동시 변경 여부 | 점검 시작/종료의 배포 ID가 같음 |

운영 소스에 main과 별도의 기능 수정이 있다고 볼 차이는 발견하지 않았다. PR #16은 기존 명령을 유지하면서 `/add`·승인 이벤트, 별도 쓰기 연결, D1 상태 저장을 추가한다. 신규 소스는 `src/index.js`와 `src/task-add.js` 두 모듈이다. GitHub 알림 코드·예약, 학생 사이트·Firebase, 기존 Notion 업무를 수정하지 않는다.

## 후보 설정과 보존 조치

`wrangler.toml`의 날짜가 운영보다 오래된 `2026-10-01`이어서 `2026-11-03`으로 보정했다. 운영의 관측 설정과 preview 비활성도 명시했다. 기능 JS와 기존 28개 검사는 유지했다. ADD_ENABLED=false에서 기존 /ping·/projects·/status·/today가 Notion 생성 없이 동작하는 회귀 검사와 승인 보호의 실패/성공 검사를 추가했다. 후보는 Secret 없이 CI의 Wrangler dry-run으로 빌드만 검사하며 업로드·배포하지 않는다.

실제 검토 대상 설정 파일은 `wrangler.production-candidate.toml`이다. 아직 이 파일로 배포하지 않았다.

- 기존 Worker 이름·workers.dev 활성·preview 비활성·호환성 날짜·확인한 관측 설정을 보존한다.
- 기존 4개 Secret은 배포 도구가 그대로 유지해야 한다. 값은 TOML이나 GitHub 코드에 넣지 않는다.
- 신규 `TASK_DB`는 기존 D1 `59dbd391-34fa-48c6-aa28-6b4240c2ff77`에 연결하는 후보만 작성했다. 운영에는 연결하지 않았다.
- `ADD_ENABLED="false"`가 초기값이다. 정상 명령 회귀와 쓰기 연결 준비 후 승인 범위 안에서 활성화한다.
- 배포 직전 활성 버전이 이번 점검 이후 바뀌었으면 차이를 다시 검토한다. 검토하지 않은 새 버전 위에 덮어쓰지 않는다.
- 커스텀 도메인·존 route 전체는 이번 조회 범위에 포함되지 않았다. 후속 배포는 route/trigger 변경 없이 버전 업로드·트래픽 전환 방식으로 계획하고, 별도 route 변경은 포함하지 않는다.

## D1 현재 상태와 실행 계획

이름 `geoteacher-task-approvals`, ID `59dbd391-34fa-48c6-aa28-6b4240c2ff77`가 일치하며 크기는 12,288바이트다. 고정된 `sqlite_schema` SELECT로 확인한 결과 `task_approvals`와 다른 사용자 테이블은 없다. 테이블 생성·마이그레이션·업무 행 조회는 하지 않았다. D1 API가 SELECT에도 POST를 사용하지만 이 점검은 읽기 SQL 한 가지만 허용한다.

사용할 SQL은 PR #16의 `migrations/0001_task_approvals.sql` 그대로다. SHA-256은 `d773b4d7b17410669c9d10e724bb46aab804cdbc3592139d6b62892c9c27ebf5`이다. 로컬 SQLite에서 다음 제약을 재검증했다.

- 승인 ID PRIMARY KEY, Telegram update_id UNIQUE로 같은 요청을 중복 생성하지 않는다.
- owner·expires_at·state NOT NULL, 상태는 pending/creating/verified/cancelled/expired로 제한한다.
- `(state, expires_at)` 인덱스가 있다. 10분 유효기간은 Worker의 조건부 승인과 만료 정리가 적용하며 D1 자동 TTL은 아니다.

GitHub Actions 실행 파일은 `.github/workflows/teacher-geoteacher-d1-migrate.yml`이다. 기존 .example 양식을 수동 실행 전용 workflow로 완성했으며 아직 실행하지 않았다. push/예약 이벤트로 동작하지 않는다. PR 병합·workflow 수동 실행·D1 변경은 여전히 승인 대상이다.

승인받은 뒤에는 다음 순서를 따른다.

1. `geoteacher-d1-production` 환경에 실제 필수 승인자가 설정되어 있는지 확인한다. 조회가 실패하거나 보호 규칙이 없으면 적용하지 않는다. 현재 이 환경의 조회는 404여서 보호 설정을 확인하지 못했다.
2. 기존 읽기 토큰은 유지한다. 승인받은 별도 계정 제한 D1 Write 토큰을 비공개 GitHub Environment Secret `CLOUDFLARE_D1_MIGRATION_TOKEN`으로 등록한다. Cloudflare 토큰의 범위가 DB 단위로 제한되지 않는 경우 고정 대상 ID와 검토한 workflow로 호출 범위를 제한하며, 이 잔여 권한 범위를 사용자에게 알린다. 등록·권한 확대는 아직 하지 않았다.
3. 실행할 workflow와 커밋을 검토한다. Wrangler는 공개 npm에서 확인한 `4.157.0`으로 고정했다. 확인 문구와 보호된 환경 승인 후에만 apply 단계가 열리며, 별도 D1 쓰기 Secret이 없으면 실제 적용 명령 전에 중단한다.
4. 적용 직전 DB 이름/ID·SQL 해시·테이블 상태를 다시 읽는다. 같은 테이블과 인덱스가 정확히 있으면 생성을 건너뛴다. 다른 구조나 다른 사용자 테이블이 있으면 중단한다.
5. 승인된 새 DB 구조만 적용한다. Worker 배포·바인딩 변경·Notion 쓰기는 이 workflow의 역할이 아니다.
6. 적용 후 구조와 인덱스를 다시 읽어 검증한다. 부분 실패나 불일치가 있으면 자동 초기화·삭제·재적용하지 않는다.

예상 영향은 전용 D1의 업무 등록 상태 테이블·인덱스와 Wrangler 마이그레이션 이력 추가다. 기존 업무·학생 데이터는 이동하거나 수정하지 않는다. **이 실행에는 별도 승인이 필요하다.**

## Notion 쓰기 연결 준비 상태

기존 업무함 스키마는 읽기 재확인했지만 사용자가 `GeoTeacher 업무등록` 내부 통합 생성과 기존 업무함 연결을 완료했다. 이를 다시 생성하지 않는다. 다만 이 통합의 실제 Read/Insert 권한·API 인증과 Insert 성공은 아직 검증하지 않았다. 운영 Worker에도 `NOTION_WRITE_TOKEN`이 없다. 이 채팅의 Notion 연결 권한은 새 Worker용 연결의 권한을 증명하지 않는다.

소유자가 이미 생성한 `GeoTeacher 업무등록` 연결에서 Read content + Insert content만 켜졌는지 확인하고 Update content·댓글·사용자 정보 권한은 끈다. 기존 읽기 연결의 권한은 바꾸지 않는다. 기존 교사 AI 업무함의 원본 DB 하나에만 연결하고 상위 페이지·다른 data source·하위 페이지 상속 범위를 확인한다.

대상 data source는 `16c3caf5-6bc2-4758-aeae-7b9ba855b2a7`이다. 신규 값은 업무명(title), 마감일시(date), 정보 등급=일반 업무(select), 진행 상태=수집됨(status), 교사 완료 확인=false(checkbox), 원본 식별키(rich_text)다. 선택지 이름을 새로 만들거나 기존 업무를 수정하지 않는다.

기존 통합의 권한 확인은 [공식 내부 통합 설정](https://www.notion.so/profile/integrations)에서 `GeoTeacher 업무등록`을 열어 진행한다. 새 통합이나 새 업무함을 만들지 않는다. 기존 읽기 연결과 구분하고 상위 업무운영실 전체를 공유하지 않는다.

토큰은 사용자만 Cloudflare의 비공개 Secret 화면에서 `NOTION_WRITE_TOKEN`으로 입력한다. 채팅·공개 코드·로그에 보내지 않는다. 해당 화면이 Save and deploy를 요구하면 즉시 운영 변경이므로 **배포 승인 전에는 저장하지 않는다**. 공식 Worker 편집기의 버전 저장 화면에서 실제로 미배포 버전만 저장할 수 있는지 먼저 확인한다. Save and deploy만 제공된다면 입력·저장을 중단하고 후보 Secret 준비를 미완료로 남긴다. 공식 CLI의 versions secret put은 미배포 버전 등록을 지원하지만, 사용자에게 채팅·문서·터미널로 인증값을 전달하도록 요구하지 않는다. 운영에 즉시 적용되는 Secret 저장을 미배포 준비로 간주하지 않는다. 준비 상태와 Secret 이름만 확인한다.

## 무료 운영 조건

별도 AI API 호출이나 추가 구독은 없다. 공식 Free 한도는 Workers 하루 100,000 요청, D1 하루 읽기 500만 행·쓰기 100,000행·전체 저장 5GB·DB 10개다. 사용량은 같은 계정의 다른 서비스와 공유될 수 있다. 인덱스 갱신도 쓰기량에 포함된다.

사용자가 2026-11-04에 Workers Free임을 직접 확인했다. Free 요금제 조건은 소유자 확인으로 충족하며, API 구독 조회 성공과는 구분한다. 이전 구독 조회는 HTTP 403이었으므로 Billing 권한을 넓히거나 같은 실패 조회를 반복하지 않는다. 현재 계정 전체 사용량은 별도 확인 대상이며, 한도를 넘기기 위해 유료 전환하지 않는다.

공식 근거: [Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/) · [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/).

기존 Telegram 수신 경로는 [읽기 전용 상태 실행 41736526176](https://github.com/happygeo21/school-web-projects26/actions/runs/41736526176)에서 확인했습니다. 기존 Cloudflare 웹훅 URL과 일치하고 대기 업데이트는 0건, 마지막 오류 기록은 없습니다. 웹훅 재등록·getUpdates·메시지 발송은 하지 않았습니다.

## 원복 경로

보존할 기준은 기존 활성 버전 `682b662b-2da1-4c0f-af5e-86c9bfd5e78a`와 기존 배포 `d6e643fc-dedb-4f07-95da-c343d1dd9518`이다. 조회와 이력 보존은 확인했지만 실제 원복 호출·쓰기 인증 검증은 실행하지 않았다.

승인된 배포 이후 문제가 생기면 신규 등록을 중지하고 진행 중인 creating 항목을 확인한다. Cloudflare Worker의 Deployments에서 사전 기록한 버전으로 트래픽을 되돌리는 경로를 사용한다. 필요한 기존 자원·Secret이 남아 있는지 확인하고, 원복 자체도 승인된 운영 변경 범위 안에서만 실행한다.

D1과 원본 식별키 기록, 기존 봇·읽기 토큰, 생성된 Notion 항목을 삭제하지 않는다. D1을 과거 상태로 되돌리면 중복 방지 기록이 사라질 수 있다. Worker 원복이 이미 생성된 Notion 업무를 취소하지는 않는다. 원복 후 /ping·/today·/status와 기존 웹훅·알림 설정을 확인한다.

## 승인 후 실제 업무 1건 검증

사용할 명령은 `/add GeoTeacher 업무 등록 연결 점검 | 오늘` 한 건이다. 날짜는 시험 당일 Asia/Seoul 기준이다.

1. Telegram 확인 화면과 등록 승인/취소 버튼, 업무함 위치·제목·기한을 확인한다.
2. 승인 전 해당 `telegram:승인ID`의 Notion 조회 0건과 D1 pending을 확인한다.
3. 교사가 승인 버튼을 누르면 생성된 페이지 ID·원본 링크를 GET 재조회하여 부모 업무함·속성·식별키를 검증한다.
4. 같은 승인 버튼을 다시 눌러도 식별키 검색 결과가 정확히 1건이어야 한다. 새 /add로 두 번째 시험 업무를 만들지 않는다.
5. /today·/status·/projects·/ping·/aside 및 기존 알림을 확인한다. 테스트 업무도 임의 삭제·완료 처리하지 않는다.

기존 GitHub 알림의 예약 실행 [41664458293](https://github.com/happygeo21/school-web-projects26/actions/runs/41664458293)은 success였으나 실제 Telegram 수신 전체를 증명하지는 않는다. Notion 아침 브리핑은 이 작업에서 설정을 변경하지 않았다. 기존 자동화의 활성 상태와 실제 다음 알림은 별도 운영 확인이 필요하며 Telegram에 중복 발송하지 않는다.

## 최종 판정

**코드·운영 비교·후보 설정·마이그레이션 계획은 준비했으나, 지금 즉시 배포할 수는 없다.** 새 Notion 연결과 Secret, D1 쓰기 인증·승인 환경 확인이 남아 있다. Workers Free는 소유자가 확인했다. 이 조건을 갖춘 뒤 PR #16 병합·D1 적용·Worker 배포·웹훅 변경·테스트 1건의 범위를 구체적으로 승인받는다. 현재 PR #16/점검 PR은 미병합이며 Worker·D1 테이블·Notion 업무를 변경하지 않았다. 최종 구축 성공 후에만 기존 Notion 관리대장·변경 로그를 갱신하고 재조회한다.
