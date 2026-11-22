# 운영 Rules 점검·이행 (게시하지 않는 절차)

> **현재 실제 운영 전체 원문 미제공: 실제 병합/호환 검증 미완료.** [운영 자료 수집표](OPERATIONS-INPUT-CHECKLIST.md#1-한눈에-보는-정보-수집표)의 F1~F5는 사용자 확인 필요입니다. 구형 제출의 awarenessOriginal 누락은 [4조합 테스트 계획](OPERATIONS-INPUT-CHECKLIST.md#4-awarenessoriginal-충돌-검증-계획)으로 확인합니다. 기존 합성 이메일 Emulator 결과를 실제 원문 검증으로 대체하지 않습니다.

현재 앱의 `TEACHER_AUTH_MODE='existing-rules'`와 Google/이메일 로그인을 유지합니다. 화면에서 확인한 이메일 승인 목록을 공개 저장소로 복사하지 않습니다. Spark를 유지하며 Storage는 비활성화합니다.

1. Console에서 실제 게시된 **전체** RTDB Rules를 저장소 밖의 비공개 파일로 내보냅니다. 화면 캡처만으로 게시 시점·전체 원문이 일치한다고 가정하지 않습니다. 이전 규칙의 원본 해시와 확인 시각을 함께 보관합니다.
2. `node veteransgeo/security/compare-rules.mjs /private/current.json veteransgeo/security/database.rules.json`을 실행합니다. 규칙 표현식 대신 해시·검토 경로만 출력하고 원본 파일은 수정하지 않습니다.
3. `node veteransgeo/security/merge-rules.mjs /private/current.json veteransgeo/security/database.rules.json /private/merged-review.json existing`으로 검토용 병합본을 만듭니다. 출력은 저장소 밖·0600·새 파일만 허용합니다. 다른 앱 루트와 최상위 규칙을 보존하고, 새 규칙의 교사 조건을 기존 submissions 읽기 이메일 승인식으로 치환합니다. 이 도구는 게시하지 않습니다. **상위에서 허용한 권한은 하위 거부보다 우선하므로 전체 diff를 사람이 검토해야 합니다.** 기존 루트 내 사용자 정의 하위 규칙도 비교하세요.
4. 신규 works/publishedWorks/audit/workAudit 및 기존 submissions/published 변경만 필요한지 확인합니다. 불필요한 claim 이행 없이 현재 승인된 교사가 텍스트·링크 검토를 수행할 수 있는지 데모 Emulator에서 먼저 검증합니다. 테스트용 교사 이메일만 사용합니다. 승인되지 않은 이메일/익명/비로그인 접근도 검사합니다. 원본 운영 이메일 목록을 테스트 로그·PR에 넣지 않습니다.
5. claim 방식을 선택한다면 별도 승인으로 기존 승인 교사 UID별 claim+allowlist를 사전 부여하고, 이메일 방식과 테스트한 후 UI 모드를 전환합니다. 누락 계정이 없는지 확인하며 claim 철회·토큰 갱신 정책도 준비합니다. `claims` 인수는 그러한 계획의 검토 후보를 생성할 때만 사용합니다. Storage Rules는 이메일 기반 RTDB 승인을 참조할 수 없으므로 파일 기능은 계속 false입니다.
6. 원본 제출은 이제 서버 규칙 후보에서 물리 삭제를 거부합니다. 교사 보관/복원 시 원자료 유지·revision 증가·공개 해제·audit 기록을 원자적으로 요청합니다. 오래된 revision은 거부됩니다. audit는 교사에게만 읽기를 허용하고 새 항목 추가만 허용합니다. 현재 초안은 원자적 audit 포함 여부 자체를 서버가 강제하는 백엔드 트리거까지 구현한 것은 아닙니다. 승인 교사가 콘솔/직접 클라이언트로 규칙 허용 필드만 수정하는 경우의 감사 강제는 추가 설계가 필요합니다.
7. 새 공개 키는 SHA256 기반 opaque ID를 사용하고 public snapshot에서 UID·활동코드·탐구 제출 ID를 제외합니다. 기존 운영 `published`의 복합 키 자체에 UID가 포함되어 있을 수 있습니다. **운영 자료를 자동 이관/삭제하지 않았습니다.** 기존 키 노출을 완전히 제거하려면 별도 승인받은 공개 사본 키 이관이 필요합니다. 새 코드의 재승인은 opaque 키를 사용합니다.
8. 새로고침 초안은 탭 sessionStorage 2시간, 원인지도와 최초 전송 내용/ID를 보존합니다. 계정이 달라지면 재전송을 막습니다. 창 종료·2시간 만료·시크릿 모드 저장 차단·기기 변경까지 복원을 보장하지 않습니다. 보관 실패 안내와 지우기 버튼을 제공합니다. 초안에 개인정보를 입력하지 않도록 안내합니다.
9. Emulator 통과와 테스트 프로젝트 실측 후에도 운영 게시/배포는 별도 승인 작업입니다. 이번에는 어떤 Rules도 게시하지 않았습니다. rollback은 비공개 원본 Rules 중 해당 루트만 복원하는 검토 작업으로 진행하며, 다른 앱 루트와 원본 학생 기록을 삭제하지 않습니다.

## 3차 적용 전 정지 조건

- [RELEASE-PREFLIGHT.md](RELEASE-PREFLIGHT.md)의 클릭 순서와 점검 시간 계획을 따릅니다. 이전 학생 웹은 새 필수 awarenessOriginal을 보내지 않으므로 수업 중 Rules만 먼저 바꾸지 않습니다.
- 운영 전체 원문이 없으면 실제 병합 후보는 만들지 않습니다. 현재 CI는 합성 이메일 목록/claim 후보 검증이며 운영 원문 검증이 아닙니다.
- submissions 읽기/쓰기와 published 쓰기의 교사 목록이 다르면 단일 읽기 승인식을 모든 쓰기에 치환하는 자동 병합을 중단하고 권한별 이행안을 검토합니다.
- 원문은 저장소 밖에 보관하고 파싱 실패 시 원문을 로그로 출력하지 않습니다. 출력 경로는 실제 상위 경로까지 확인하여 저장소로 향하는 심볼릭 링크도 거부합니다.
