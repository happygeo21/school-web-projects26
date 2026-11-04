# GeoTeacher 3.2 배포 전 준비·승인 기록

2026-11-04 업데이트: GitHub Actions를 통한 운영 소스·설정·D1 읽기 조회를 완료했습니다. 현재 결과와 보류 조건은 [운영 적용 준비 결과](./PRODUCTION_READINESS.md)를 우선 확인합니다. 아래 접근 연결 대기 내용은 초기 점검 기록입니다.

## 현재 판정

**배포 보류: 운영 Cloudflare 접근 및 별도 Notion 쓰기 연결의 근거가 없다.**
사용자의 후속 요청은 D1 준비를 허용하지만 운영 배포는 준비 결과를 검토한 뒤 별도 승인하도록 요구한다. 아래 준비 명령은 아직 실행하지 않았다.

- 최신 main: `7e795d7e46784b666a29b3e0552f20e879d4618f`.
- 검토한 PR #16 기능 커밋: `de754eb3b9f4eb5305f4f8b12de6860b03e6fc82` (2026-11-03 18:40:10 KST).
- PR은 초안·미병합, main과 충돌 없음. 28개 로컬 검사 재통과 및 기존 CI success 재확인.
- GitHub 알림 워크플로의 평일 16:50 KST 예약 유지. 최근 확인한 수동 실행 [41585196078](https://github.com/happygeo21/school-web-projects26/actions/runs/41585196078) success. 이것만으로 Telegram 실제 수신이나 예약 실행 완료를 입증하지 않는다.
- 현재 환경은 Notion 읽기 인증만 제공한다. Cloudflare 인증·브라우저 제어 도구가 없고 네트워크 허용 목록에도 Cloudflare가 없다. 설치 가능한 Cloudflare 플러그인 검색 결과도 없었다. 인증 우회나 추가 유료 서비스 설치는 하지 않았다.

## 로그인된 소유자 환경에서 준비할 순서

### 1. 운영 스냅샷과 원복 기준 — 읽기 전용

Cloudflare에서 기존 `geoteacher-telegram-gateway`를 열고 Deployments의 **Active** 배포 ID, 각 트래픽 버전 ID·비율을 기록한다. 최신 업로드 버전만 보고 운영 코드로 간주하지 않는다. 다음 명령은 버전 목록 확인용이며 배포하지 않는다.

```sh
npx wrangler deployments list --name geoteacher-telegram-gateway
```

활성 버전의 전체 소스, compatibility date/flags, 라우트·workers.dev, 일반 설정, 바인딩 이름/유형, Secret 이름만 확인한다. Secret 값을 열지 않는다. 소스·설정 백업은 저장소 밖의 비공개 폴더에 보관하고 공개 PR이나 Pages에 올리지 않는다. 일반 변수에 인증값이 들어 있다면 그것도 공유하지 않는다.

원본 소스와 main/PR 소스의 바이트 해시를 비교한다. 번들 소스와 모듈 소스는 빌드 구조가 달라 단순 해시가 다를 수 있으므로 차이 검토 없이 불일치 또는 동일을 단정하지 않는다. `/today`, `/status`와 기존 인증 검사, 대시보드 직접 수정분이 있는지 확인한다.

이전 활성 버전이 Cloudflare에서 원복 가능한 버전으로 남아 있는지 확인한다. [원복 공식 문서](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)에 따라 연결 자원 삭제·변경과 데이터 구조 차이를 점검한다. 원복 동작 자체는 실제 배포이므로 준비 단계에서 시험 실행하지 않는다.

### 2. D1 Free 준비 — 기존 Worker 배포 없음

소유자 계정의 Workers 요금제가 Free인지, D1 개수·저장·일일 사용량이 Free 한도 안인지 먼저 확인한다. Paid 계정이거나 요금 상태가 불명확하면 무료 운영 가능으로 표시하지 않고 중단한다. 업그레이드·결제·새 구독은 하지 않는다.

```sh
npx wrangler d1 list
```

동일 이름 DB가 없을 때만 만든다. 이미 있다면 DB ID·테이블 구조를 읽고 일치 여부를 확인한다. 다른 용도 DB를 덮어쓰거나 초기화하지 않는다.

```sh
npx wrangler d1 create geoteacher-task-approvals
```

생성된 실제 ID를 **기존 운영 설정을 보존한 배포 후보 설정 파일**의 `[[d1_databases]]`에 추가한다. 이 파일에는 토큰을 넣지 않는다. `binding="TASK_DB"`, `database_name="geoteacher-task-approvals"`, `migrations_dir="migrations"`를 사용하고, 경로는 후보 설정 파일 위치를 기준으로 실제 소스·마이그레이션을 가리키게 한다. 운영 Worker의 바인딩 적용 버튼은 누르지 않는다.

아래의 `후보설정경로`는 준비한 로컬 파일의 실제 경로로 바꾼다. DB ID와 테이블 목록부터 재확인한다.

```sh
npx wrangler d1 info geoteacher-task-approvals --config "후보설정경로"
npx wrangler d1 execute geoteacher-task-approvals --remote --config "후보설정경로" --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
npx wrangler d1 migrations list geoteacher-task-approvals --remote --config "후보설정경로"
```

새 DB이거나 정확히 이 기능용 DB로 확인된 경우에만 다음을 적용한다. 임의의 다른 데이터가 있거나 구조가 다르면 중단한다.

```sh
npx wrangler d1 migrations apply geoteacher-task-approvals --remote --config "후보설정경로"
npx wrangler d1 execute geoteacher-task-approvals --remote --config "후보설정경로" --command "PRAGMA table_info(task_approvals);"
npx wrangler d1 execute geoteacher-task-approvals --remote --config "후보설정경로" --command "PRAGMA index_list(task_approvals);"
```

`update_id` UNIQUE, 승인 ID PRIMARY KEY, 상태 CHECK와 만료 인덱스가 있는지 확인한다. 업무명·owner·기한 등 실제 행은 출력하지 않는다. 마이그레이션 실패는 성공으로 처리하지 않고 원인부터 확인한다. D1 준비만으로 운영 `TASK_DB` 바인딩이 활성화되지는 않는다.

### 3. 별도 Notion 최소 권한과 Secret

[Notion 권한 문서](https://developers.notion.com/reference/capabilities)에 따라 새 연결의 Read content와 Insert content만 활성화한다. Update content·댓글·사용자 정보는 끈다. 접근 목록에는 기존 업무함 원본 DB 하나만 허용하고 상위 페이지·다른 데이터 소스·하위 페이지 상속 범위를 확인한다. 기존 읽기 연결은 바꾸지 않는다.

권한 설정 화면과 접근 목록은 토큰이 없는 화면에서 확인한다. 이 채팅의 Notion 연결이나 읽기 API 성공은 새 쓰기 연결의 Insert 권한 증거가 아니다. Insert 권한은 설정 화면 검토와 승인받은 1건 생성 시험으로 검증한다. Update 금지를 시험하기 위해 기존 업무를 수정 요청하지 않는다.

운영 소스 비교 후, 소유자 PC의 비표시 입력창에서 다음을 실행한다. 토큰을 명령행·환경 설정 예시·채팅·스크린샷·공개 파일에 붙이지 않는다. 입력 녹화나 디버그 로그도 켜지 않는다.

```sh
npx wrangler versions secret put NOTION_WRITE_TOKEN --name geoteacher-telegram-gateway
```

이 명령은 미배포 버전을 만든다. `wrangler secret put`, 대시보드 Deploy, `wrangler deploy`, `versions deploy`는 이 단계에서 실행하지 않는다. 이후 Active 배포 ID·트래픽 버전이 준비 전과 같은지 확인한다. Secret은 이 미배포 버전에 준비된 것이며 아직 운영에 적용되었다고 보고하지 않는다. 최종 배포 후보 버전에도 기존 Secret과 새 Secret이 모두 있는지 이름으로 확인한다.

### 4. 승인 요청에 필요한 실제 근거

| 항목 | 현재 상태 | 승인 요청 전에 채울 값 |
|---|---|---|
| 운영 Active 배포·트래픽 버전 | 미확인 | 실제 ID·비율·확인시각 |
| 운영/main/PR 소스 비교 | 미완료 | 해시·모듈 목록·차이 검토 |
| 기존 바인딩/설정 보존 | 미확인 | 값 없는 이름·유형 목록 |
| D1 Free·DB ID·구조 | 미생성/미확인 | 실제 확인 결과 |
| 별도 Notion 연결·권한·대상 | 미확인 | 권한·접근 범위 확인 결과 |
| 미배포 Secret·후보 바인딩 | 미준비 | 후보 버전 ID·이름 목록 |
| 원복 가능 이전 버전 | 미확보 | 이전 활성 버전 ID와 복구 경로 |
| 운영 기능 사전 확인 | 미검증 | /ping·/today·/status 응답 결과 |

실제 값과 최종 코드 검토 결과가 모이면 그 후보에 대한 배포 승인을 요청한다. 빈 표나 테스트 통과만으로 승인 요청을 대신하지 않는다. 실제 배포·웹훅 설정 변경·테스트 1건의 수행 범위를 구체적으로 적는다.

### 5. 승인 뒤 1건 시험과 회귀

[기존 운영 설명서](./NOTION_ADD_RUNBOOK.md)의 1건 시험 절차를 따른다. 제목은 `GeoTeacher 업무 등록 연결 점검`, 기한은 테스트 당일 KST다. 교사가 Telegram에서 내용을 확인하고 승인 버튼을 눌러야 한다. 다른 프로그램에서 사용자를 가장해 승인하거나 getUpdates를 호출하지 않는다.

승인 전 식별키 조회 0건 → 승인 후 생성·GET 재조회 → 동일 승인 재클릭 후 1건을 확인한다. 생성한 테스트 항목도 임의 삭제·완료 처리하지 않는다. 취소·오류·개인정보 시험은 모의 테스트로만 수행한다.

배포 전후 `/today`, `/status`, `/ping`, `/projects`, `/aside`의 실제 응답과 GitHub 알림 설정을 비교한다. Notion 아침 브리핑은 Notion의 기존 자동화 설정·대상·활성 상태를 읽기 확인하며 Telegram에 다시 발송하지 않는다. 자동화 설정 접근이 없으면 미검증으로 남긴다. 운영 코드 원복 시 D1과 식별키 기록을 보존한다.
