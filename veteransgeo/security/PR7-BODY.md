## 목적과 운영 상태

기억의 좌표 LIVE의 학생 독립 작품 제출 → 교사 비공개 검토·승인 → 공개 카드 피드를 구현하고 안전한 운영 전환을 준비합니다. 학생/교사/공개 3페이지, 학생 3단계, 7학교, 기존 Google/이메일 인증, Firebase RTDB 루트와 e-GIS CSV를 유지합니다.

**Draft 유지 / main 미병합 / 운영 미배포.** 운영 Rules·학생 자료·기존 Firebase 설정·다른 앱·요금제는 변경하지 않았습니다. Firebase Spark와 `MEDIA_UPLOAD_ENABLED=false`를 유지하며 Firebase Storage SDK 의존을 제거했습니다. 외부 미디어 Provider도 기본 비활성화입니다.

## 실제 구현

- 학생: 같은 페이지 독립 제출 버튼·간단한 폼, 글/사진/포스터/카드뉴스/영상/PDF/링크, 미리보기·이미지 압축, 진행률·취소·같은 ID/파일 재시도·내 상태. 실패 시 글/선택 파일 유지, 새로고침 후 같은 파일 재선택.
- 교사: 검색/상태별 대기함, 비공개 미리보기, 승인/수정 요청/반려/승인 해제/보관/복원, 제목·소개 수정, 학생 원본·이력 열람, 사용량/고아 파일 점검. 기존 탐구 수정·이력·CSV 보존.
- 공개: PC 3열/태블릿 2열/모바일 1열 갤러리, 타이포 카드·이미지 lazy load·영상 클릭 재생, 필터·최신순·더 보기·상세·지도 연계. UID/활동코드/원본 제출 ID를 공개 사본에 넣지 않습니다.
- 무료 저장 구조: Supabase Free용 비공개 버킷/SQL 예약 원장/Edge 게이트웨이와 HTTP Provider, 계정 없는 로컬 Mock을 구현했습니다. **실제 Supabase 연결 완료가 아닙니다.**
- 보안: Firebase RS256/kid/시간/aud/iss/sub 검증, 학교 활동코드·교사 승인 UID·RTDB 권한 확인, 서버 전용 service role, 파일 바이트/시그니처/SHA256/용량 검증, 중복/한도/불일치 복구. 서명 원본 URL 대신 매 요청 공개 승인 검사·no-store 응답을 사용합니다.
- 공식 시설: 검색 정규화/지역 우선/작품 폼 연결 개선. 실제 공식 캐시는 여전히 비어 있으며 가짜 시설/좌표는 추가하지 않았습니다.

상세 코드·무료 한도·설정·제약은 [MEDIA-IMPLEMENTATION.md](https://github.com/happygeo21/school-web-projects26/blob/codex/veteransgeo-upgrade/veteransgeo/security/MEDIA-IMPLEMENTATION.md)를 참조하세요.

## 테스트와 미검증

- [x] 로컬 core 9개 및 기존 가상 브라우저 통합 1개: 7학교·권한 오류/초안/동일 ID·교사 수정/이력·CSV/지도·모바일
- [x] 신규 로컬 미디어 6개: Chromium 이미지 압축/WebM 업로드·취소·승인/피드/해제, Mock 게이트웨이 계약, 실제 RSA JWT 검증, Postgres WASM의 SQL/RLS/예약/한도
- [x] Edge 진입점 Deno 타입 검사, 공개 산출물 Pages 99개/Netlify 18개 경계 확인
- [ ] 최신 head의 Firebase Emulator CI 결과는 Checks/최종 검토 기록에서 별도로 확인(로컬 JAR 다운로드 403)
- [ ] 실제 운영 전체 Rules 원문 병합/호환성 검증
- [ ] 별도 Firebase 테스트 프로젝트 실제 Auth/7학교/구형·신규 4조합/승인 계정 리허설
- [ ] 실제 Supabase Storage·Edge·RLS·Range·승인 해제 지연·동시 업로드/사용량 실측
- [ ] 실제 공식 데이터·좌표계/축·재사용 조건 확보
- [ ] 실제 Netlify preview의 보호 뒤 Firebase 대상/배포 경계·운영 설정 확인

Mock 파일 업로드 성공은 실제 Supabase 업로드 성공이 아닙니다. 이번 수정 전 CI 성공과 최신 head 결과도 구분합니다. 테스트 상세/실행 링크는 검토 문서를 확인하세요.

## Firebase Rules와 permission_denied

인증 성공과 DB 저장 권한을 분리하고 최초 제출 payload/ID·사전 인지도를 보존합니다. **실제 운영 permission_denied 원인은 전체 게시 Rules/Auth 정보가 없어 미확정입니다.**

구형 학생 웹은 awarenessOriginal을 보내지 않고 신규 strict 후보는 새 생성에 요구합니다. 조건을 약화하지 않았으며 구형 새 제출 거부·파일 원본/체크섬 변경 거부·신규 작품 상태를 테스트에 추가했습니다. 실제 운영 원문이 없으므로 실제 병합 완료로 표시하지 않습니다. 기존 이메일 승인과 다른 앱 루트/최상위 권한을 보존해 별도 테스트 후 수업 외 동시 전환이 필요합니다.

[운영 자료 수집표](https://github.com/happygeo21/school-web-projects26/blob/codex/veteransgeo-upgrade/veteransgeo/security/OPERATIONS-INPUT-CHECKLIST.md), [RULES-MIGRATION.md](https://github.com/happygeo21/school-web-projects26/blob/codex/veteransgeo-upgrade/veteransgeo/security/RULES-MIGRATION.md), [RELEASE-PREFLIGHT.md](https://github.com/happygeo21/school-web-projects26/blob/codex/veteransgeo-upgrade/veteransgeo/security/RELEASE-PREFLIGHT.md)를 따릅니다. 후보 JSON을 운영에 통째로 게시하면 안 됩니다.

## 개인정보·무료 운영·배포 보류

이미지 3MiB/영상 15MiB/PDF 5MiB·1파일, 70% 경고·90% 새 영상 제한·공간 초과 차단·개인/프로젝트 제출 상한을 구현했습니다. Free 공식 문서의 저장 1GB/전송 5GB/함수 50만 회를 확인했으나 실제 계정 사용량은 미계측입니다. 앱 전송 원장은 보수적 추정이며 Dashboard 사용량과 대조해야 합니다. 큰 영상은 외부 링크를 사용합니다. 자동 유료 전환/결제 등록은 하지 않습니다.

실제 학생 자료·운영 쓰기 테스트를 사용하지 않았고 새 키/교사 명단을 커밋하지 않았습니다. 이미지 재인코딩은 원본 EXIF를 복사하지 않지만 얼굴·보이는 개인정보·영상/PDF 속성·악성파일·저작권까지 해결하지 않습니다. 교사 검토가 필요합니다. 승인 해제는 새 요청을 차단하며 이미 받은 사본은 회수하지 못합니다. 토큰 철회의 즉시 감지·자동 정리 cron·대용량 재개 업로드는 미구현입니다.

두 Netlify preview 정적 점검은 HTTP 401이었으며 배포 실패인지 접근 보호인지는 관리 화면 확인이 필요합니다. 인증 우회/보호 해제를 하지 않습니다. 저장소 Firebase 설정은 운영을 가리키므로 preview에서 쓰기/로그인 테스트를 하지 않았습니다. 환경변수만 넣어 테스트로 전환되지 않습니다. Edge 코드도 현재 운영 Firebase를 명시적으로 거부합니다.

실제 Rules 백업/병합, 별도 Firebase/Supabase 테스트, Netlify 설정/복구 기준이 없어서 **신규 기능 운영 수업 적용은 보류**합니다. 가상 실습은 `npm run mock:media`로 실행할 수 있습니다. main 병합은 Pages 배포를 시작할 수 있으므로 별도 승인 전 금지입니다.

## 전환·롤백

전체 Rules 원본을 저장소 밖에 비공개 백업하고 이전 Pages SHA·두 Netlify Published ID를 확보합니다. 별도 테스트 통과 및 승인 후 점검 시간에 해당 앱 Rules와 웹을 함께 전환합니다. 실패 시 이전 웹과 해당 앱 Rules를 함께 복구하며 다른 앱의 최신 권한/학생 원본/이력은 보존합니다. 미디어 연결을 닫더라도 보관 파일을 무조건 삭제하지 않습니다. Supabase Secret 철회/비공개 백업·복구도 별도 검토합니다. 이번에는 운영을 바꾸지 않아 운영 롤백 실행이 필요 없습니다.

## Notion

미반영: 이번 범위는 기존 PR/개발 코드이며 Notion 외부 쓰기를 하지 않았습니다. 복사 문안: “PR #7 무료 미디어 Provider·비공개 게이트웨이·학생 업로드·교사 검토·공개 피드 구현 / 가상 브라우저·JWT·SQL·게이트웨이 검증 / 실제 테스트 Firebase/Supabase·공식 자료 미확보 / 운영 적용 보류 / main·운영 Firebase·배포·요금제 변경 없음”. SHA/KST와 최종 CI는 Git 기록을 함께 기재합니다.
