## 목적과 운영 상태

기억의 좌표 LIVE의 학생 제출 복구, 교사 검토·이력, 독립 홍보 작품 제출과 공개 전시를 개선하고 안전한 운영 전환을 준비합니다. 학생/교사/공개 3페이지, 학생 3단계, 7학교 설정, 기존 데이터 루트, Google/이메일 교사 인증과 e-GIS CSV를 유지합니다.

**운영 적용 판정은 보류입니다.** main 병합·운영 Rules 게시·운영 데이터 수정/삭제·실제 production 배포·Blaze 변경을 하지 않았습니다. MEDIA_UPLOAD_ENABLED=false를 유지합니다. 이 PR을 자동 병합하지 마세요.

**Draft 유지. 이번 후속 작업은 문서 정리만 하며 기능을 추가하지 않습니다.** 최신 정보 수집 항목과 테스트 연결 절차는 [운영 자료 수집표](https://github.com/happygeo21/school-web-projects26/blob/codex/veteransgeo-upgrade/veteransgeo/security/OPERATIONS-INPUT-CHECKLIST.md), 기존 전환/복구 기준은 [RELEASE-PREFLIGHT.md](https://github.com/happygeo21/school-web-projects26/blob/codex/veteransgeo-upgrade/veteransgeo/security/RELEASE-PREFLIGHT.md), [RULES-MIGRATION.md](https://github.com/happygeo21/school-web-projects26/blob/codex/veteransgeo-upgrade/veteransgeo/security/RULES-MIGRATION.md)를 참조하세요. 이 본문은 API Forbidden에 대비한 붙여넣기 완성본이며 PR 실제 반영 여부와 별개입니다.

## 구현 내용

- 학생: 사전 인지도 고정, 수동 위치/공식지도 대체 입력, 탭 초안 복원, 동일 제출 ID·최초 payload 재시도, 인증/권한/네트워크 오류 안내.
- 교사: 제출 검색, 검증 후 수정, 전후 값·수정자·시각 이력 열람, 원본 보관/복원, 수정 시 공개 해제와 재승인, 기존 CSV 보존.
- 작품: 탐구 기록 없이 텍스트·허용된 외부 링크 독립 제출, 초안/재시도, 교사 수정·반려·승인·비공개 전환. 직접 파일 업로드는 비활성화.
- 공개: 승인된 사본만 갤러리 표시, 학교/시설/유형 필터, 지도 핀 연결, 신규 공개 사본의 UID·활동코드·탐구 제출 ID 제외. 외부 원본의 공유권한은 앱 승인과 별개입니다.
- 공식 시설: 검증 캐시·자동완성 UI·안전한 갱신 도구를 구현했지만 실제 공식 시설 목록은 확보하지 못했습니다. 빈 캐시를 유지하며 가짜 시설/좌표/지정 상태를 등록하지 않았습니다.

## permission_denied와 Rules 호환성

로그인 성공과 저장 권한을 분리합니다. 학생 선행 DB 읽기를 강제하지 않고 UID 저장 경로를 검사하며, 실패/새로고침 후 동일 기록으로 복구합니다. 실제 운영 오류의 원인은 전체 게시 Rules와 Auth 설정이 없어 확정하지 않았습니다.

기존 학생 웹은 awarenessOriginal을 보내지 않지만 신규 Rules 후보는 이를 요구합니다. 수업 중 Rules만 먼저 바꾸면 기존 제출이 차단될 수 있습니다. 기존 형식을 무조건 허용하는 규칙은 신규 측정 원자료 보호를 우회할 수 있어 자동 적용하지 않습니다. 전체 원문 확보·권한별 비교·테스트 프로젝트 실측 후 점검 시간에 Rules와 웹을 함께 전환하는 방안을 준비했습니다.

이메일 기반 교사 승인을 우선 보존합니다. claim 전환을 무단 적용하지 않습니다. 신규 works/audit/workAudit/publishedWorks 경로와 다른 앱 루트·전역 권한을 실제 원문과 비교해야 합니다. 후보 JSON 전체를 운영에 붙여넣으면 안 됩니다.

## 실행한 검증과 미검증

- [x] 기존 CI에서 브라우저 SDK 대역 통합, claim 방식 6개 + 합성 이메일 승인식 병합본 6개 Emulator 시나리오 성공
- [x] 비공개 Rules 오류 로그/경로 경계 검사를 포함한 core 9개 로컬 통과
- [x] 공개 산출물 94개/Netlify용 13개 검증 및 로컬 개발 파일 제외 확인
- [x] 가상 데이터로 7학교 제출, 실패·복원·동일 ID, 교사 수정·이력 요청, 작품·CSV·모바일 흐름 검사
- [ ] 실제 운영 Rules 전체 원문을 사용한 병합본 검증
- [ ] 별도 Firebase 테스트 프로젝트의 실제 Auth·7학교·동시 수정/승인 실측
- [ ] 실제 운영 주소/인증 제공자/승인 도메인 확인
- [ ] 공식 API 응답·좌표계/축·이용 조건과 실데이터 캐시 확보
- [ ] Storage 실제 권한·비용·버킷·파일 공개 검증(이번 전환 대상 제외)

확인한 [기존 CI](https://github.com/happygeo21/school-web-projects26/actions/runs/40812211435)는 `8cffa728b6a061888b19593ed4645f9550a91c16`에서 Success(1분 12초)입니다. 위 체크는 기존 검증 범위이며 이번 문서 수정으로 실제 서비스 실측이 추가된 것은 아닙니다. CI 성공은 운영 Firebase 실사용 성공을 의미하지 않습니다. 최신 문서 커밋의 Checks는 해당 head의 결과를 별도로 확인하세요.

### 사용자 확인 필요 — 추가 개발로 대신하지 않는 자료

- Firebase: 게시된 전체 Rules 비공개 원문/해시·다른 앱/전역 권한·경로별 승인식, 실제 Auth 제공자/승인 도메인, 별도 테스트 projectId/DB 호스트.
- Netlify 두 사이트: Published deploy ID/SHA·현재 운영 주소, base/build/publish/context, preview 산출물의 실제 Firebase 대상, 401 보호 설정과 승인된 관리자의 접근 결과, security/ artifact 제외 여부.
- 복구 기준: 이전 Pages SHA·두 사이트 Published ID·해당 앱 Rules 백업. 공식 시설 원자료·좌표계/축·이용 조건은 미확보입니다.

전체 운영 Rules 원문이 제공되기 전에는 **실제 병합본 생성·컴파일·호환 검증 완료로 표시하지 않습니다.** 별도 테스트 프로젝트도 아직 연결하지 않았습니다. 구형/신규 코드 × 기존/신규 Rules 네 조합, 신규 경로·미승인 계정·인지도 위변조 검증은 수집표의 미실행 계획입니다.

## PR #7 Deploy Preview 주의

Netlify veteransgeo/happygeo Deploy Preview 성공은 production 배포와 구분합니다. 정적 GET 전용 점검 CI에서 두 preview의 홈/설정 파일은 HTTP 401로 보호되어 실제 Firebase 연결값을 읽지 못했습니다. 저장소 설정은 운영 프로젝트 school-project-26-1edf4를 가리키므로, 인증된 Deploy file browser에서 확인하기 전까지 운영 연결 가능성으로 취급합니다.

미리보기에서 제출·수정·삭제·교사 로그인 테스트를 하지 마세요. 학생 페이지의 익명 인증이나 공개 페이지의 구독은 페이지 실행만으로 운영 서비스에 접속할 수 있습니다. 이번 점검은 JS를 실행하지 않고 정적 파일 및 public Auth 설정 GET만 설계했으며 DB/Storage/학생 자료 요청은 하지 않았습니다. 보호 화면으로 막혀 실제 Auth 승인 도메인과 로그인 후 security/ 경계는 미확인입니다.

401만으로 배포 실패를 단정하지 않습니다. 승인된 관리자 화면에서 해당 SHA의 Deploy log와 Visitor access/Deploy protection 설정을 구분해 확인해야 합니다. 인증 우회·보호 해제는 하지 않습니다. 현재 빌드는 Firebase 설정을 그대로 복사하므로 **Netlify 환경변수만 넣어서는 테스트 프로젝트로 바뀌지 않습니다.** 우선 저장소 밖 로컬 웹 복사본에만 테스트 설정을 넣고 정적으로 projectId/DB 호스트를 확인하는 절차를 마련했습니다. preview 빌드 오버레이·별도 배포는 이번에 구현/적용하지 않습니다. 기존 운영 firebase-config.js는 변경하지 않습니다.

happygeo 소스는 main 대비 변경하지 않았습니다. 같은 Firebase 프로젝트의 다른 앱 루트를 보존해야 하며, happygeo Deploy Preview 성공이 기억의 좌표의 운영 권한 검증을 대신하지 않습니다.

## 개인정보·보안과 배포 보류 사유

실제 학생 자료를 테스트에 사용하지 않았고 새 API 키·비밀번호·토큰·교사 이메일 목록을 커밋하지 않았습니다. 원본 Rules는 저장소 밖 비공개 보관이 필요합니다. 기존 공개 복합키의 UID는 별도 승인 이관이 필요할 수 있고, 자유서술·외부 파일의 개인정보/얼굴/저작권은 교사가 검토해야 합니다.

원문 Rules 백업, 권한 호환성, 별도 테스트 프로젝트 실측, 두 Netlify 설정과 배포/복구 기준이 준비되지 않아 production 배포를 하지 않습니다. GitHub main 병합은 Pages 자동 배포를 시작할 수 있으므로 별도 승인 전 병합 금지입니다.

## 전환·롤백

수업 외 점검 시간에 제출/승인을 멈추고 원본 Rules 해시·이전 Pages 커밋·Netlify Published ID를 백업합니다. 검증한 이메일 승인식 병합본과 웹 코드를 함께 전환하고 두 사이트를 독립 점검합니다. 실패하면 점검을 유지하고 이전 웹과 해당 앱 Rules를 함께 복구합니다. 다른 Firebase 앱의 최신 루트·전역 권한과 학생 원본은 보존하며 전체 DB 삭제나 main 강제 reset은 하지 않습니다.

## Notion

미반영입니다. 이번 작업은 PR #7 정리·검증 범위이며 Notion 외부 쓰기를 수행하지 않았습니다. 자동 동기화 설치나 기록 성공을 주장하지 않습니다.

추가 문안: “기억의 좌표 LIVE PR #7 운영 자료 수집표 정리 / Draft 유지 / 전체 게시 Rules·preview 정적 설정/401 보호·별도 테스트 프로젝트는 사용자 확인 필요 / awarenessOriginal 충돌 실측 및 로컬 테스트 연결 계획 작성 / 운영 적용 보류 / main·운영 Firebase·배포·Storage·Blaze 변경 없음”. 커밋 SHA/KST는 최종 Git 기록을 함께 기재합니다.
