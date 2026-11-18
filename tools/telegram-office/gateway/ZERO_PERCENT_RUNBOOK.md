# GeoTeacher 3.2 — 승인형 0% 후보 배포 실행 지침

## 2026-11-13 통합 조사 결과 — 오프라인 JSON 검증 준비, 실제 실증 차단

시작 기준 main `e99163fa954d2e1ba90b25a298f87f840f5a372d`, PR #25 `16b84c207ed0fd2a8df1e08c55d01b7e897e54e1`와 깨끗한 작업 트리를 재확인했다. 아래 결론이 이전 단계의 pretty 재실행 계획보다 우선한다. 실제 Worker 요청·Tail·배포·권한 변경은 실행하지 않았다.

| 경로 | 공식 근거와 판단 |
|---|---|
| 고정 Wrangler 4.157.0 JSON | [printing.ts](https://github.com/cloudflare/workers-sdk/blob/wrangler@4.157.0/packages/wrangler/src/tail/printing.ts)의 `jsonPrintLogs`는 수신 객체를 그대로 전달하고 [logger.ts](https://github.com/cloudflare/workers-sdk/blob/wrangler@4.157.0/packages/wrangler/src/logger.ts)는 들여쓰기 4의 다중 행 JSON을 출력한다. [createTail.ts](https://github.com/cloudflare/workers-sdk/blob/wrangler@4.157.0/packages/wrangler/src/tail/createTail.ts)의 공개 TailEventMessage에는 scriptName/event.request는 있지만 scriptVersion.id 보장이 없다. 선언 부재가 서버에서 절대 안 온다는 증거는 아니며, 실제 제공 여부는 미확인이다. 조건부 JSON 파서를 선택하되 실증 가능한 transport로 인정하지 않는다. |
| 연결·재시도 | [index.ts](https://github.com/cloudflare/workers-sdk/blob/wrangler@4.157.0/packages/wrangler/src/tail/index.ts)는 연결 배너를 pretty에서만 출력하고 연결 단절 시 내부 재연결을 수행한다. JSON에서 배너를 기다리는 기존 방식은 부적합하며 단순 대기 연장으로 해결되지 않는다. 무재연결 transport와 이벤트 내용으로 위조할 수 없는 연결 신호가 필요하다. |
| 버전 필터 | [filters.ts](https://github.com/cloudflare/workers-sdk/blob/wrangler@4.157.0/packages/wrangler/src/tail/filters.ts)는 `--version-id`를 서버의 scriptVersion 필터로 전달한다. 후보 필터는 유용한 출처 제약이지만 요청별 명시적 ID를 제공하지 않으므로 이번 성공 조건을 대신하지 않는다. |
| Observability | [Query API](https://developers.cloudflare.com/api/resources/workers/subresources/observability/subresources/telemetry/methods/query/)는 조회 의미의 POST에도 `Workers Observability Write` 권한을 요구한다. 현재 세션에는 조회 토큰/계정 값이 없으며 기존 보호 환경 토큰의 권한도 이 작업에서 확인하지 않았다. 기존 권한으로 가능하다고 주장하지 않고 API 호출·권한 확대를 하지 않는다. 구현한다면 고정 Worker/시간창/메서드/정확한 마커와 명시적 실행 버전을 같은 invocation에서 확인해야 하며 집계 개수는 대체 증거가 아니다. |
| 비용·노출 | [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)는 저장형 로그로 요청·응답 및 사용자 console 데이터가 포함될 수 있다. 2026-11-13 문서 기준 Free 20만 이벤트/일·3일 보관, Paid 월 2천만 포함·초과 백만당 $0.60·7일 보관이며 12월 1일 요금 변경 예고가 있다. 실제 계정 요금제·사용량은 미확인이다. 유료 기능이나 로그 설정을 활성화하지 않는다. |

첫 실행 #41957672115의 소스 `8c0f9c35dcb9019514590673f8e9f3f07bf5c00d`는 JSON 모드로 배너를 기다렸다. **형식과 연결 판정의 불일치는 소스에서 확인**했지만 당시 실제 소켓 접속 성공 여부는 알 수 없다. 두 번째 실행의 Tail 1/2는 여전히 GET/POST 누락 종류·전송 지연·파싱·override 중 어느 원인인지 미확정이다.

### 구현 범위와 실행 차단

- `TailJSONStream`은 단일/다중 행, 청크 경계, 문자열 내부 괄호/escape를 처리한다. 이벤트 UTF-8 64 KiB, JSON 중첩 32단계, 파이프 한 행 16,384문자, 대기 큐 64행으로 제한한다. 파싱 실패·중복 키·크기/깊이 초과·불완전 JSON은 고정 실패 코드로 종료한다. 원문은 메모리에서만 처리하고 종료 시 버퍼/큐를 비운다.
- `scriptName`이 정확한 Worker여야 한다. URL·메서드·마커를 정확히 대조하고 최상위 `scriptVersion.id`가 실제 존재할 때만 ID를 인정한다. `$workers`나 사용자 logs 안의 ID를 추측해 채우지 않는다. **합성 양성 이벤트의 ID는 조건부 계약 시험용이며 실제 Wrangler가 해당 필드를 제공한다는 증거가 아니다.**
- 30초 관측 창에서 중복은 고유 요청 수를 늘리지 않으며, 두 요청 뒤 도착한 상충 버전도 실패한다. 순서/지연은 허용하되 시간 밖의 이벤트는 증거로 인정하지 않는다. 기존 `all_http`, `all_tailed`, 두 요청 ID 일치 조건을 모두 유지한다.
- `gate`, `verify`, 직접 `run_tail_probe`는 **`tail_transport_unverified`로 외부 I/O 전에 중단**한다. 환경변수로 우회할 수 없다. 실시간 transport는 미완성이므로 기존 배너 기반 연결 코드는 합성 테스트에만 사용하며 JSON의 연결 보장으로 주장하지 않는다. `review`는 기존 메타데이터 조회 용도로 유지하지만 이번 작업에서는 실행하지 않는다.
- 향후 승인된 transport에서도 Wrangler 로그 파일 기록은 `WRANGLER_WRITE_LOGS=false`로 비활성화한다. 프로세스 정지·reader 종료 대기·버퍼 및 메모리 임시 폴더 정리를 합성 테스트한다. 원격 Tail 삭제 성공은 모의 검사로 입증할 수 없고 실제 연결 경로 검증 때 확인해야 한다.
- 보고는 연결/HTTP/관측/요청별 ID 일치/배포 비율 확인 여부, 고정 요청 종류, 개수와 실패 코드로 제한한다. 버전 UUID·계정·실행 식별자·URL·쿼리·헤더·원문은 출력하지 않는다.

### 합성 입력과 기대 결과

| 입력 (모두 합성) | 기대 결과 |
|---|---|
| 고정 Worker의 GET·POST + 각각 후보 ID, 역순/다중 행/청크 분할 | 양쪽 요청·ID 일치; HTTP도 일치할 때만 성공 |
| GET만, POST만, 없음, 동일 요청 중복만, 제한 시간 밖 POST | 누락 요청 명시·실패 |
| 두 요청 ID 없음, 한 요청 ID만 있음 | 관측과 버전 확인을 분리·실패 |
| 운영 버전/잘못된 후보/나중에 온 상충 버전 | 고정 오류·중단·정리 |
| 다른 Worker·다른 경로·마커 변조·추가 query·외부 URL | 증거에서 제외; redirect는 전송하지 않음 |
| 무관한 JSON 이벤트 및 민감 로그/쿠키 필드 | 필요한 필드만 선택, 민감 값 비출력 |
| 잘못된 JSON·중복 키·과도한 크기/중첩·중간 종료 | 고정 오류·중단·버퍼 정리 |
| 연결 실패/시간 초과, 큐/행 제한 초과 | 실패; 연결 전에는 HTTP 0회 |
| transport 미검증 상태의 gate/verify/직접 호출 | 프로세스·HTTP·메타데이터 I/O 모두 0회 |

### 최종 판정 및 후속 조건

**현재 권한과 검증된 CLI 계약만으로 요청별 후보 실행 실증 불가. 실증 재승인 요청도 보류.** JSON 파싱을 완성했어도 연결·명시적 ID·자동 재연결 차단의 세 조건이 충족되지 않았다. 다음 단계는 실제 요청을 반복하는 것이 아니라 해당 세 조건을 보장하는 공식 인터페이스/기존 권한 경로를 확정하는 것이다. metadata binding·응답 헤더 추가는 새 Worker 버전을 요구하므로 이번 범위 밖 대안이다.

PR은 비운영 진단 변경으로 검토할 수 있으나 Draft를 유지하고 병합하지 않는다. 재검증 문구는 아직 제공하지 않는다. 세 조건을 코드·합성 검증으로 충족한 뒤에만 별도 병합 승인, 보호 환경 승인, 후보 Tail 1회·익명 GET 1회·무인증 POST 1회·전후 메타데이터 조회 범위를 승인받는다. 과거 배포와 다르면 시작하지 않는다. 성공해도 100%/0% 유지, 실패하면 재시도/권한 확대/임의 rollback 없이 중단한다.

## 2026-11-13 진단 보강: 실증 미완료, 재실행 보류

- 기존 PR #25 HEAD `4fbdfc33a3f56d1909ef1ee873ae26174eeaf1b3`와 main `e99163fa954d2e1ba90b25a298f87f840f5a372d`를 대조했다. main의 추가 변경은 이 진단과 별개인 보안 검사 워크플로이며 gateway 운영 소스 차이는 없다. e-GIS PR #28 변경은 포함하지 않는다.
- 과거 첫 실행은 연결 확인 실패로 요청 전 중단했고, 두 번째는 HTTP 검사 2개 성공·Tail 매칭 1개·명시적 버전 ID 없음으로 실패했다. 원문 로그를 저장하지 않고 허용된 결과 필드만 대조했다. 누락된 요청 종류, 전송 지연, 파서 불일치, override 적용 여부는 과거 기록만으로 확정할 수 없다.
- 성공은 기존 HTTP 검사와 `all_tailed`를 모두 유지하고, **GET과 POST 각각 명시적 후보 버전 ID가 일치**해야 한다. ID가 없는 2/2 이벤트도 실패/미검증이다. 부분 일치 마커, 추가 쿼리, 자격정보/포트/fragment가 섞인 URL은 관측 증거로 인정하지 않으며 HTTP redirect는 따라가지 않는다.
- **당시 `--format pretty` 요청 행에는 명시적 버전 ID가 없었다.** 이후 통합 조사에서 조건부 JSON 파서와 실행 차단을 추가했다. 위 최신 절의 세 가지 차단 조건이 해결되기 전에는 Tail 재실행을 요청하지 않는다. 새 Worker 배포나 metadata binding 추가로 우회하지 않는다.
- 로컬 Windows에 실행 가능한 Python이 없으면 설치/정책 변경 없이 기존 GitHub Actions의 Python 3.12 검사를 사용한다. 테스트는 합성 이벤트만 사용하고 운영 로그/Secret/마커를 출력하거나 artifact로 저장하지 않는다. CI 통과는 운영 성공 증거가 아니다.

### 별도 승인 후 가능한 최소 실증 절차

1. 요청별 후보 ID를 확보하는 출력 경로의 코드·합성 테스트를 먼저 검토한다. PR은 Draft로 유지하며 병합은 별도 승인 대상이다. 현 워크플로의 최신 main·보호 환경 승인 조건을 우회하지 않는다.
2. 실행 직전 비민감 메타데이터 GET으로 기존 Deployment, 기존 100%/후보 0%, 후보 `ADD_ENABLED=false`를 확인한다. 과거 값과 다르면 중단하고 새 승인을 받는다.
3. 교사가 **후보 버전 필터 Tail 세션 1회 + Version Overrides를 지정한 익명 GET /health 1회 + 무인증 POST /telegram-webhook 1회 + 전후 배포 메타데이터 조회**를 승인한다. 연결 50초, 관측 30초의 제한을 유지하며 재시도하지 않는다. 보호 환경 승인과 확인 문구 `VERIFY TAIL ONLY geoteacher-telegram-gateway`가 필요하다.
4. 요청별 HTTP 결과, 관측/누락된 고정 요청 종류, 요청별 후보 ID 확인 여부, 허용된 라인 수와 실패 코드만 보고한다. 연결 실패 시 요청을 보내지 않고, 종료 시 Tail 세션과 메모리 임시 로그를 정리한다.
5. **성공:** 후보 무쓰기 실증만 확인한다. 기존 100%/후보 0%를 유지하고 운영 전환·기능 활성화·웹훅 변경은 각각 별도 승인을 기다린다.
6. **실패/ID 부재:** 미검증으로 종료하고 자동/수동 재시도를 하지 않는다. 고정 진단 필드로 연결/관측/버전 증거 부족을 구분해 보고한다. 배포 상태가 달라졌다면 교사에게 알리고 중단하며 임의 rollback도 하지 않는다.

이번 진단 작업에서는 Cloudflare 실시간 Tail/HTTP 프로브/배포 조회 워크플로를 실행하지 않는다. 따라서 현재 운영 100% 보존을 직접 재조회한 것으로 보고하지 않는다. Telegram·D1·Notion 쓰기, 토큰·Secret·권한 변경, main 병합은 포함하지 않는다.


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
- Wrangler Live Tail 세션은 신규 후보 버전으로 필터링하고 익명 `GET /health`·무인증 `POST /telegram-webhook` 요청을 **각 1회** 수행합니다. 고유 마커가 붙은 두 이벤트가 모두 관측되고 각각 명시적 후보 version ID가 일치해야 성공이며, Tail 원문(사용자 정보·인증정보 포함 가능)은 절대로 출력하거나 저장하지 않습니다. 위 2026-11-13 보류 조건을 먼저 충족해야 합니다.
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
