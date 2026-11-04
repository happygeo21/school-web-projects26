# GeoTeacher 미배포 Worker 후보 준비

## 현재 확정된 상태

- PR #16은 main `4d1746fdd82409a7d8a30287e94856f087e84cdc`에 병합되었다. 원래 기능 코드·SQL·후보 TOML은 변경하지 않는다.
- [D1 적용 41769237145](https://github.com/happygeo21/school-web-projects26/actions/runs/41769237145)의 승인 보호·원격 적용·구조 검증이 성공했다. **새 DB 생성이나 마이그레이션 재실행은 하지 않는다.** 이전 미적용 보고는 과거 상태다.
- `GeoTeacher 업무등록` 통합 생성과 기존 업무함 연결은 완료다. 재생성하지 않는다. Read/Insert만 허용됐는지는 소유자가 기존 통합 설정에서 확인한다. API 인증·후보 Secret은 아직 미검증이다.
- Workers Free는 소유자가 확인했다. 유료 서비스·AI API를 추가하지 않는다.

## 보안 입력과 승인 환경

일반 Cloudflare Settings의 Secret 저장과 `wrangler secret put`은 즉시 배포하므로 사용하지 않는다. 공식 `wrangler versions upload --secrets-file`을 사용하면 검토한 코드·설정·새 Secret을 미배포 버전으로 묶고 기존 Secret을 보존할 수 있다.

별도의 `geoteacher-worker-staging` GitHub Environment를 제안한다. 현재 자동 승인 심사가 환경명·검토자·본인 승인 설정에 대한 명시적 승인이 부족하다는 이유로 생성을 거절했으므로 **아직 생성하지 않았다**. 승인 요청할 설정은 다음과 같다.

- 필수 승인자: 저장소 소유자 `happygeo21`.
- 단독 소유자가 수동 실행을 승인할 수 있도록 본인 승인은 허용, 관리자 우회는 금지.
- 허용 브랜치: `audit/geoteacher-production-readonly`와 `main`만 지정. 보호된 환경 생성과 브랜치 제한 확인 후에만 Secret을 입력한다.
- 환경 Secret은 `NOTION_WRITE_TOKEN`과 `CLOUDFLARE_WORKER_STAGING_TOKEN` 두 개다. 기존 D1 환경·쓰기 토큰과 혼용하지 않는다.

환경 준비가 승인·완료되면 소유자가 [저장소 Environments 공식 설정](https://github.com/happygeo21/school-web-projects26/settings/environments)에서 해당 환경의 Add environment secret 화면으로 직접 입력한다. 토큰 값·토큰 화면을 채팅에 보내거나 코드·문서·workflow 입력 인자에 넣지 않는다. 값은 GitHub가 암호화 보관하며 Actions 승인 이후 해당 단계에만 제공한다. 후보 검증 후 임시 보관 Secret 제거는 별도 확인해 진행한다.

`CLOUDFLARE_WORKER_STAGING_TOKEN`은 [Cloudflare 공식 API Token 설정](https://dash.cloudflare.com/profile/api-tokens)에서 별도로 발급한다. 대상 계정의 Workers Scripts Edit만 우선 허용하고 D1 Write·Billing·DNS/Zone 변경 권한은 주지 않는다. 계정 단위 Worker 권한이므로 다른 Worker에도 적용될 수 있다는 잔여 범위가 있으며, workflow는 이름과 계정·기존 버전을 고정해 사용한다. 추가 권한 오류가 있으면 상태 코드와 호출을 구분해 중단하며 자동으로 권한을 확대하지 않는다. 기존 읽기 토큰은 그대로 둔다.

기존 [Notion 내부 통합 설정](https://www.notion.so/profile/integrations)에서 `GeoTeacher 업무등록`의 Read content·Insert content만 켜졌는지, Update·댓글·사용자 정보 권한이 꺼졌는지와 기존 업무함 하나의 접근 범위를 확인한다. 이 확인은 새 통합 생성 요청이 아니다. Insert 권한 자체는 읽기 GET으로 증명할 수 없으므로 실제 업무 생성 승인 전까지 API 쓰기 성공으로 보고하지 않는다.

## GitHub Actions 실행 경로

기존 `.github/workflows/teacher-cloudflare-preflight.yml`을 확장한다. 이 workflow는 main에 이미 존재하므로 PR #18의 브랜치에서 기존 경로로 실행할 수 있다. 코드·workflow 추가는 PR #18에서 검토하며 이번 작업에서 병합하지 않는다.

1. `review=true`, `stage_candidate=false`로 실행하면 읽기만 수행한다. 실제 소스·설정·D1 구조와 웹훅 `allowed_updates`를 조회하고 Secret 값·원문·업무 행 없이 결과만 출력한다. 운영의 기존 버전·소스 해시·설정이 달라지면 후보 준비를 중단한다.
2. 후보 업로드에는 `review=true`, `stage_candidate=true`, 확인 문구 `STAGE ONLY geoteacher-telegram-gateway` 및 기존 Notion 최소 권한 확인이 필요하다. 그 후 실제 필수 승인자가 있는 환경인지 먼저 조회한다. 없거나 읽을 수 없으면 환경 Job을 열지 않는다.
3. 필수 승인자가 승인하면 고정 main 커밋 `4d1746fdd82409a7d8a30287e94856f087e84cdc`를 checkout한다. 현재 버전·최신 버전·D1 적용 구조·후보 설정을 확인한다. 최신 미배포 버전이 이미 있으면 검토 없이 Secret을 상속하지 않고 중단한다.
4. 새 Notion 토큰은 기존 data source `16c3caf5-6bc2-4758-aeae-7b9ba855b2a7`의 스키마 GET에만 사용한다. 생성·수정·업무 행 조회를 하지 않으며 Worker의 실제 `validateSchema` 함수를 그대로 사용한다.
5. Wrangler `4.157.0`의 **versions upload**만 실행한다. 자동 리소스 생성은 끄며 D1 apply·versions deploy·트래픽 변경·웹훅 재등록 명령은 포함하지 않는다. `ADD_ENABLED=false`다.
6. CLI가 요구하는 Secret 파일은 저장소·디스크 산출물 대신 runner 메모리 파일시스템 `/dev/shm`의 권한 600 임시 JSON으로만 만든다. CLI stdout/stderr는 캡처하며 원문을 출력하지 않는다. CLI/npm 로그도 같은 임시 경로를 쓰고 성공·실패·시간 초과 시 정리한다. Secret 파일·로그를 artifact로 업로드하지 않는다. 강제 runner 종료 시에도 임시 메모리는 runner 폐기와 함께 사라진다.
7. 새 ID를 받은 즉시 ID만 기록하고 API로 후보의 기존 Secret 4개 + 새 쓰기 Secret, 정확한 D1 ID, ADD_ENABLED=false와 호환성 날짜를 확인한다. 실제 현재 배포 ID·버전·100% 트래픽이 바뀌지 않았는지 다시 조회한다. API 응답 유실/오류 시 자동 재업로드하지 않는다.

## 후보와 운영 전환을 구분

운영 기준은 버전 `682b662b-2da1-4c0f-af5e-86c9bfd5e78a`, 배포 `d6e643fc-dedb-4f07-95da-c343d1dd9518`이다. 검토된 후보 설정은 TASK_DB 연결과 새 Secret을 추가하지만 현재 트래픽·웹훅·읽기 연결·GitHub 알림·Notion 아침 브리핑은 변경하지 않는다.

웹훅의 `allowed_updates`에 `callback_query`가 없으면 배포 승인 때 기존 URL·secret_token을 유지하고 `message`와 `callback_query`를 허용하는 계획을 제시한다. `drop_pending_updates=false`로 기존 메시지를 보존한다. 이 단계에서 setWebhook을 실행하지 않는다. 응답에 allowed_updates가 생략되면 미확인으로 남긴다. 명시적 빈 배열은 Telegram 기본 수신 유형으로 callback_query를 포함한다.

후보가 실제 생성·검증된 뒤 새 ID를 지정한 `wrangler versions deploy` 트래픽 전환을 별도로 승인받는다. 문제가 생기면 위 정상 버전으로 되돌리며 D1·중복 방지 기록·Notion 원본은 삭제/원복하지 않는다. 실제 원복 호출은 현재 실행하지 않는다.

실제 Telegram 테스트 `/add GeoTeacher 업무 등록 연결 점검 | 오늘`은 최종 배포 승인 후 한 건만 사용한다. 승인 전 0건 → 승인 후 ID/링크 GET 재조회 → 중복 승인 후 정확히 1건 → 기존 명령과 실제 알림 수신을 확인한다. 후보 생성이나 모의 테스트만으로 실연동 완료라고 보고하지 않는다.

## 공식 근거

- [Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/): 일반 Secret의 즉시 배포, versions upload의 additive Secret 보존.
- [Cloudflare Deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/): 버전 생성과 운영 트래픽 배포의 구분.
