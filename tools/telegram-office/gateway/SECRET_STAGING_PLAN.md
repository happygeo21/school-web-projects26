# GeoTeacher 미배포 Secret 준비 계획

현재 상태: Notion 전용 내부 통합은 소유자가 생성·관리자 인증·Read content/Insert content 및 업무함 접근 범위를 준비 중이다. 토큰은 소유자가 비공개로 보관한다. PR #16의 기능 코드와 검사를 변경하지 않으며, 연결 준비 완료 확인 전에는 D1 적용·권한 확대·배포 승인 단계로 넘어가지 않는다.

## 공식 문서로 확인한 차이

| 방법 | 효과 | 이번 단계 |
|---|---|---|
| Worker Settings의 Variables and Secrets에서 Add 후 Deploy | 운영 배포를 수행 | 사용하지 않음 |
| wrangler secret put | 새 버전을 만들고 즉시 배포 | 사용하지 않음 |
| wrangler versions secret put | Secret을 포함한 새 버전만 생성 | 보안 입력 경로와 쓰기 권한 승인 뒤 검토 가능 |
| wrangler versions upload --secrets-file | 코드·설정·Secret을 함께 미배포 버전으로 업로드 | 검토한 후보를 정확히 묶는 우선 검토 경로 |

코드 편집기의 Deploy 옆 Save로 미배포 코드 버전을 저장할 수 있다는 사실만으로, Settings의 Secret 입력도 미배포 저장이라고 판단하지 않는다. Secret 대시보드의 공식 절차는 Deploy로 끝난다. 토큰을 입력하고 Deploy를 누르도록 소유자에게 안내하지 않는다.

## 준비와 실행을 구분한 순서

1. 소유자가 새 Notion 연결의 권한과 대상 DB를 확인하고 준비 완료를 알린다. 기존 읽기 연결은 그대로 둔다. 토큰이나 토큰이 보이는 화면은 전달받지 않는다.
2. 이후에만 후보 Secret을 공급할 승인된 보안 경로와 작업 환경을 확정한다. 현재 Codex/Actions에는 새 Notion 토큰과 Worker 쓰기 권한이 연결되어 있지 않다. 토큰을 GitHub Secret 등 다른 저장소로 임의 복사하거나 등록하지 않는다. 사용자에게 채팅·문서·코드·명령행 인자로 값을 보내도록 요구하지 않는다.
3. 후보 버전 업로드도 외부 변경이므로 필요한 Worker 쓰기 권한과 미배포 버전 생성 범위를 확인·승인받은 뒤 실행한다. 기존 읽기 전용 Cloudflare 토큰의 권한을 확대하지 않는다. 여기서는 실행하지 않았다.
4. 실행 직전 Active 버전과 latest 버전을 읽어 확인한다. latest가 Active와 다르고 검토하지 않은 버전이면 작업을 중단한다. Secret 명령이 예상 밖의 최신 코드/설정을 기반으로 새 버전을 만들지 않게 한다.
5. 승인된 보안 경로가 마련되면 검토한 PR #16 소스·wrangler.production-candidate.toml·NOTION_WRITE_TOKEN을 하나의 미배포 버전으로 묶는 공식 versions upload 경로를 우선 검토한다. 이때 ADD_ENABLED=false를 유지한다. 값이 담긴 임시 입력 파일을 사용해야 한다면 승인된 실행 환경의 저장소 밖 제한된 임시 경로로만 공급하고, 값·파일 내용·응답 원문을 로그나 artifact에 남기지 않는다. 임시 파일로 전달할 수 있는 안전한 경로가 없으면 중단한다.
6. 새 버전 ID를 기록하되 그 버전에 트래픽을 배정하지 않는다. 기존 4개 Secret은 보존하고 새 Secret 이름만 추가됐는지 확인한다. 원래 Secret 값을 읽거나 재입력하지 않는다.
7. Active 배포 ID·버전·100% 트래픽과 기존 웹훅이 준비 전과 같은지 재조회한다. 새 후보의 소스·설정·바인딩을 검토하여 NOTION_WRITE_TOKEN·TASK_DB·ADD_ENABLED=false가 예상한 후보에 포함되는지 확인한다. Secret 값 자체는 재조회하지 않는다.
8. D1 적용과 실제 배포는 별도로 승인받는다. 실제 배포에는 검증한 후보 버전 ID를 지정하고 versions deploy/승격을 사용한다. 준비 과정에서 일반 deploy, Secret Deploy, 트래픽 전환, 웹훅 재설정은 실행하지 않는다.

## 남은 조건

- Notion 전용 연결 생성·인증·권한·대상 확인은 소유자 진행 중이다.
- 안전한 Secret 입력 경로와 Worker 쓰기 인증은 아직 미준비이며 승인 없이 새로 만들지 않는다.
- D1 쓰기 인증·승인 보호도 별도 준비 대상이다. D1 테이블은 미적용 상태를 유지한다.
- Workers Free는 소유자가 확인했다. 새로운 구독이나 AI API를 사용하지 않는다.
- Secret 준비 방법의 문서 검토가 완료되었다는 것은 후보 버전이 생성되었거나 토큰이 등록되었다는 뜻이 아니다.

## 공식 근거

- [Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/): 일반 Secret 저장의 배포 효과, versions secret put, versions upload의 secrets-file 및 이전 Secret 보존 설명.
- [Cloudflare Deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/): 버전 생성과 운영 트래픽 배포의 구분.
