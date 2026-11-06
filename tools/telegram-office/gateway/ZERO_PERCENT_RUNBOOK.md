# GeoTeacher 3.2 — 승인형 0% 후보 배포 실행 지침


## 2026-11-05 두 번째 Live Tail 검사: HTTP 정상, Tail 1/2 (재실행 금지)

- [실행 #41988508339](https://github.com/happygeo21/school-web-projects26/actions/runs/41988508339)에서 사전 확인과 보호 환경 승인 성공. `GET /health` 200/ok, 무인증 `POST /telegram-webhook` 403/Forbidden도 정상.
- **후보 버전 필터에서 일치하는 Tail 이벤트는 1/2건만 관측**했고 명시적 version ID는 보고되지 않았으므로 전체 검증 실패. 어느 요청의 이벤트가 누락됐는지 기존 로그로 알 수 없으며, 두 요청 모두 후보 버전에서 실행됐다고 주장할 수 없음.
- 검사 전후 기존 Deployment ID 유지, 기존 버전 100%·후보 0%·`ADD_ENABLED=false` 확인. Cloudflare 배포·비율 조정, Telegram 메시지, 웹훅·D1·Notion 쓰기 0건.
- 원인은 **미확정**: 실시간 Tail 전송·샘플링, Wrangler pretty 출력 형식과 파서 불일치, version override 미적용 가능성을 구별해야 함. 단순 HTTP 상태만으로 후보 버전 증명을 대체할 수 없음.
- 후속 별도 초안 PR은 **고정된 GET/POST 경로 중 어느 Tail 이벤트가 관측/누락됐는지**와 stdout/stderr의 **라인 수만** 출력하는 모의 테스트용 진단 강화임. raw Tail 라인, URL 쿼리, 마커, 헤더, 토큰, 학생 정보는 저장하거나 출력하지 않음.
- 이 개선도 실시간 Tail 검증에 **성공한 것으로 보고하지 말 것**. PR 병합, Tail 재실행, 권한 변경, 운영 전환은 각각 별도 사용자 승인이 필요하며 실패한 작업은 재실행하지 않음.


## 2026-11-05 Live Tail 최초 실행 실패 및 개선안 (배포 없음)

- [Tail 실증 실행 #41957672115](https://github.com/happygeo21/school-web-projects26/actions/runs/41957672115): `read-only-preflight`, `verify-protected-approval` 성공. 기존 100%·신규 0%·`ADD_ENABLED=false`를 원격 조회 확인함.
- 실패 작업 `read-only-tail-smoke`의 메시지: `Could not confirm tail connection; no HTTP probes sent.` Tail 연결 완료 문구를 **35초 안에 감지하지 못해** 실패. **추가 GET/POST 요청 0건**; Cloudflare 배포·트래픽·웹훅·D1·Notion 쓰기 변경 없음. 실제 실행 버전 증거도 미확보.
- 이전 `--format json` 방식은 Wrangler의 연결 상태 출력과 다중 행 JSON 처리에 의존해 감지하지 못할 수 있어, `--format pretty`로 연결 배너와 단일 요청 행만 인메모리 분석하도록 변경. 이는 **가능한 출력 형식 원인에 대한 보완**이지, 실제 실패 원인이 확정됐다는 뜻은 아님.
- 연결 대기 35초 → 50초, 단순한 Tail 연결 출력 기준을 명시적으로 검사. 실패 시 Secret·로그 원문을 출력하지 않고 `tail_auth_or_scope_rejected`, `tail_cli_option_rejected`, `tail_socket_or_network_error`, `tail_output_seen_but_no_connection_banner` 등 허용된 진단 코드만 보고.
- **연결이 확인되기 전에는 HTTP 요청을 절대 보내지 않는다.** 실제 예외가 다시 발생하면 동일 워크플로 자동/수동 재실행·권한 확대·운영 전환을 진행하지 않고 진단 코드로 원인을 확인.
- 이 개선은 별도 PR 초안 및 CI 회귀검사로만 준비함. **별도 병합 승인 및 실제 Tail 재실행 승인 전에는 운영에 적용/실행하지 않음.**


## 최신 후속 단계: 후보 버전만 필터링한 Live Tail 검사 (2026-11-05)

2026-11-04 [무쓰기 HTTP 실행 41823439479](https://github.com/happygeo21/school-web-projects26/actions/runs/41823439479)은 GET 200/ok, 무인증 POST 403/Forbidden에 성공했으나 **실제 후보 버전의 실행 ID를 별도로 입증하지 못했습니다**. Cloudflare Observability 과거 로그 API는 Workers Observability Write를 요구하므로 토큰 권한을 확대하지 않고, 기존 보호 환경의 Worker 편집 토큰으로 가능한 `wrangler tail --version-id`를 사용합니다.

- [PR #23](https://github.com/happygeo21/school-web-projects26/pull/23)의 `teacher-geoteacher-tail-smoke.yml`은 **수동 실행 전용**이며 `verify_tail=false`가 기본값입니다. PR 병합 자체는 네트워크 검증이나 Worker 배포를 실행하지 않습니다.
- PR 병합을 먼저 별도 승인받고, 그 뒤 [Tail 검사 GitHub Actions](https://github.com/happygeo21/school-web-projects26/actions/workflows/teacher-geoteacher-tail-smoke.yml)에서 `main` 선택, `verify_tail` 체크, 확인 문구 `VERIFY TAIL ONLY geoteacher-telegram-gateway` 입력, 보호 환경 `geoteacher-worker-staging` 검토자 승인 순서로 실행합니다.
- 실제 Tail 검사를 시작하기 전 Cloudflare Deployment `99157fb4-d5bd-4d3d-b2f7-e01171158ff7`가 여전히 기존 버전 `682b662b-2da1-4c0f-af5e-86c9bfd5e78a` **100%** / 신규 후보 `9d91cea3-c8d3-4322-902c-520fd7d4687b` **0%**인지 메타데이터 GET만으로 확인합니다. 다르면 **중단**합니다.
- Wrangler Live Tail 세션은 신규 후보 버전으로 필터링하고 익명 `GET /health`·무인증 `POST /telegram-webhook` 요청을 **각 1회** 수행합니다. 고유 마커가 붙은 두 이벤트가 후보 버전 필터에서 모두 관측돼야 성공이며, Tail 원문(사용자 정보·인증정보 포함 가능)은 절대로 출력하거나 저장하지 않습니다.
- CLI가 필터를 지원하지 않거나 Tail 연결에 실패하면 **무검증/중단**으로 처리하고, 트래픽 비율이나 권한을 확대하지 않습니다. GitHub Actions의 성능·모의 테스트 성공은 실제 Tail 관측 성공과 구분합니다.
- 최종 출력은 HTTP 검사 2개·후보 Tail 이벤트 2개 관측 여부·배포 ID와 100/0 비율 불변 여부로 제한합니다. Notion/D1 읽기·쓰기, Telegram 메시지 발송/웹훅 수정, Cloudflare 운영 트래픽 변경은 포함하지 않습니다.
- [Cloudflare Wrangler Tail](https://developers.cloudflare.com/workers/wrangler/commands/workers/#tail) · [Workers 최소 권한](https://developers.cloudflare.com/workers/authorization/workers/) 참조.

---

2026-11-04 KST 기준. **이 문서와 PR은 실제 Cloudflare 배포를 실행하지 않습니다.** 워크플로는 PR 별도 승인 및 병합 후에만 main에서 수동 실행할 수 있습니다.

## 정확한 배포 목표

| 구분 | 버전 또는 값 |
|---|---|
| Worker | geoteacher-telegram-gateway |
| 현재 정상 버전 | 682b662b-2da1-4c0f-af5e-86c9bfd5e78a |
| 기존 Deployment ID | d6e643fc-dedb-4f07-95da-c343d1dd9518 |
| 업로드 완료된 신규 후보 | 9d91cea3-c8d3-4322-902c-520fd7d4687b |
| 목표 | 기존 정상 버전 100% + 신규 후보 0% |
| 신규 기능 플래그 | ADD_ENABLED=false |
| 보호 환경 | geoteacher-worker-staging |
| 실행 승인자 | happygeo21 |

**주의:** 0% 설정도 새 Cloudflare Deployment를 생성합니다. 사용자 승인 없이 실행하지 않습니다. 신규 후보에 0.01%라도 일반 트래픽을 배정하는 대체 방안은 허용하지 않습니다.

## 보호된 수동 실행 흐름

- 워크플로: .github/workflows/teacher-geoteacher-zero-percent.yml
- 안전 스크립트: tools/telegram-office/gateway/scripts/worker_zero_deploy.py
- 입력의 stage_zero 기본값은 false입니다. 기본 수동 실행은 읽기 전용 점검만 수행합니다.
- 실제 0% 배포 단계에는 stage_zero=true, 정확한 확인 문구 ZERO ONLY geoteacher-telegram-gateway, happygeo21 직접 실행, 최신 main 검증, 승인자/관리자 우회 금지 검증, 기존 보호 환경의 별도 승인이 모두 필요합니다.
- 승인 전 preflight는 Cloudflare 버전·배포 메타데이터, 기존 Secret 이름/유형, 기존 D1 스키마, Telegram webhook의 getWebhookInfo만 검사합니다. D1 스키마 조회에 사용되는 POST는 읽기 SQL SELECT로만 제한됩니다.
- GitHub 기본 Secret CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / TELEGRAM_BOT_TOKEN을 읽기 전용으로 사용합니다. 보호 환경 Secret CLOUDFLARE_WORKER_STAGING_TOKEN은 사용자 승인 후 CLI 실행용으로만 사용합니다. **NOTION_WRITE_TOKEN은 이 워크플로에 전달하지 않습니다.**
- Cloudflare CLI는 Wrangler 4.157.0으로 고정하며, 기존 버전 100%와 정확한 신규 후보 0%만 한 번 지정합니다. 비율·버전·환경이 하나라도 다르면 배포를 중단합니다.
- CLI stderr/stdout이나 Secret 값 원문은 출력하지 않습니다. 임시 로그는 Runner의 메모리 폴더에만 기록하고 정리합니다. 결과가 불분명하면 재실행하지 않고 Cloudflare Deployment 메타데이터를 재조회합니다.
- Cloudflare Wrangler CLI 문서는 신규 0%를 공식 지원하지만, API 모델에는 최소 0.01이라는 표기가 있어 차이가 있습니다. 서버가 0%를 거부하면 그대로 실패 종료하며 0.01% 대체, 자동 재시도, 운영 승격을 금지합니다.

### PR 별도 병합 승인 후, 0% 배포 자체가 별도로 승인되었을 때만

1. [GitHub Actions](https://github.com/happygeo21/school-web-projects26/actions/workflows/teacher-geoteacher-zero-percent.yml)에서 브랜치 main을 선택합니다.
2. stage_zero 체크 후 confirmation에 ZERO ONLY geoteacher-telegram-gateway 를 정확히 입력합니다.
3. Run workflow를 누릅니다. 먼저 read-only-preflight 및 verify-protected-approval 완료를 확인합니다.
4. Review deployments 메뉴에서 geoteacher-worker-staging을 선택하여 보호 환경 승인자가 승인합니다.
5. stage-zero-only가 성공하면 결과에서 새 Cloudflare Deployment ID와 두 버전 비율을 읽기 재조회합니다. 목표는 기존 100%, 후보 0%의 정확한 두 버전입니다.
6. 신규 후보 트래픽을 100%로 올리지 않고, 다음 단계인 후보 지정 무쓰기 smoke test를 별도로 검토합니다.

### 검증할 고정 CLI 명령 (참고용, 이 문서 작성 시 실행 안 함)

    npx --yes wrangler@4.157.0 versions deploy 682b662b-2da1-4c0f-af5e-86c9bfd5e78a@100% 9d91cea3-c8d3-4322-902c-520fd7d4687b@0% --name geoteacher-telegram-gateway --yes --message "GeoTeacher approved old 100 percent candidate zero percent"

## 다음 단계: 0% 후보의 읽기 전용 확인

Cloudflare 공식 Version Overrides 헤더를 사용합니다. **0% 배포가 완료된 뒤에만** 신규 버전을 지정할 수 있습니다.

    curl.exe -i "https://geoteacher-telegram-gateway.ksoundmin.workers.dev/health" -H 'Cloudflare-Workers-Version-Overrides: geoteacher-telegram-gateway="9d91cea3-c8d3-4322-902c-520fd7d4687b"'

예상 결과는 200 및 ok입니다. 인증 없는 POST /telegram-webhook 요청은 403이어야 합니다. 두 테스트 모두 Telegram 메시지·Notion 업무·D1 행을 생성해서는 안 됩니다.

**응답만으로 신규 버전 지정 성공이라고 주장하지 않습니다.** 정상 버전도 같은 값을 반환하므로 Cloudflare Observability의 실제 실행 version_id와 일치하는지를 확인해야 합니다. 버전 확인 증거가 없으면 신규 후보 smoke test는 미검증으로 기록합니다.

## 실패와 원복

- 0% 배포가 실패하거나 API 결과가 불분명할 때 워크플로를 다시 실행하지 않습니다. Cloudflare의 현재 Deployment ID와 비율을 우선 조회합니다.
- 원복 대상은 기존 정상 버전 **682b662b-2da1-4c0f-af5e-86c9bfd5e78a**의 100%입니다.
- Cloudflare Dashboard → Workers & Pages → geoteacher-telegram-gateway → Deployments → 기존 정상 버전 → Rollback.
- Rollback은 새로운 Deployment를 생성하므로 이전 Deployment ID가 그대로 복구된다고 가정하지 않습니다.
- 원복은 별도 운영 변경 승인 대상입니다. D1·Notion·Telegram webhook·GitHub 기존 알림과 기록을 삭제·수정하지 않습니다.
- 이 워크플로에는 일반 운영 배포, rollback, setWebhook, Notion POST pages, D1 migrate, Secret 추가·수정 명령이 없습니다.

## 이번 PR의 검증 한계

CI는 모의 API/CLI·분기·승인·비율 검사만 실행합니다. 실제 0% Deployment 생성이나 텔레그램 명령 왕복의 성공 증거가 아닙니다. 별도 승인과 보호 환경 승인 전에는 새 배포가 존재하지 않습니다.

공식 문서:
- https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/#versions-deploy
- https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/
- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/create/
