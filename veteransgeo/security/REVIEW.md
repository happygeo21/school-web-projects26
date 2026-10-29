# 기억의 좌표 LIVE 업그레이드 — 배포 전 검토 초안

이 변경은 **완료된 운영 배포가 아닙니다**. 공식 API·실제 Rules·Storage 상태 확인 및 에뮬레이터 실측이 남아 있습니다. `MEDIA_UPLOAD_ENABLED=false`를 유지합니다. 운영 Firebase에 요청하거나 데이터를 변경하지 않았습니다.

## 1. 진단 근거와 단계별 결과

기준 main: `c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5`. 원격 main을 fetch하여 읽고 `codex/veteransgeo-upgrade`에서 작업했습니다. 기존 `firebase-config.js`의 프로젝트·DB URL·루트 `memoryTemperature2026` 및 7개 학교 설정은 유지했습니다.

| 단계 | 코드에서 확인한 문제 | 이번 변경 및 검증 | 남은 확인 |
|---|---|---|---|
| 1 진단 | 학생은 익명 로그인 직후 “제출 준비 완료”로 표시, 저장 실패와 인증 실패를 구별하지 않음. 매 클릭 push()로 새 ID 생성. 교사 onAuthStateChanged 안에서 onValue 해제 함수 미보관. 스냅샷의 schoolId가 실제 경로를 덮어쓸 수 있었음 | 인증과 저장 권한 문구 분리, 고정 ID 재시도, 리스너 해제·세션 세대 검사, 실제 경로 ID를 마지막에 적용 | 운영 Rules 파일은 저장소에 없음. 사용자가 제공한 Console 화면으로 경로·학생 UID 쓰기·교사 이메일 읽기 조건은 확인. 전체 원문/게시 시점 대조 전 실제 오류 원인 미확정 |
| 2 공식 시설 | 기존 검색은 Nominatim 일반 지명 검색. 공식 시설 API와 무관하며 주소 선택만으로 공식 지정 증거가 되지 않음. 인지도 변경 가능 | 사전 인지도 확정 후 탐색, 수정 불가 원자료 snapshot, 공식 캐시 검증·학교 지역 우선·이름/주소 검색·자동 위치/출처 입력, 공식지도/직접입력 대체 흐름 | 사용자 제공 공식 문서 화면에서 JSON `http://mfis.mpva.go.kr/api/json/allSearch.do`, XML `/api/xml/allSearch.do` 주소 확인. 실행 환경에서는 공식 사이트 프록시 403. 실제 응답·CORS·이용 조건·좌표계/축 순서 미검증. 캐시는 의도적으로 비어 있으며 **공식 목록 자동검색 실데이터 미완료** |
| 3 제출 복구 | 무제한 좌표 숫자 변환, 원시 오류 노출, 중복 생성 가능 | 클라이언트 입력/좌표 검증, 학생용 오류 분류, 익명 재연결, 내용 유지·최초 시도 내용/ID 재사용, 민감정보 없는 범주 로그 | 세션 새로고침 후 작성 초안 전체 복원은 미구현. 운영 익명 인증/실제 저장 미검증 |
| 4 교사 수정 | 수정 기능 없음, 로그인은 교사 승인 여부와 다름 | 필드별 수정 dialog, 입력 검증, 원인지도 수정 제외, 전후 값·UID·시각 audit, atomic update로 수정+공개 해제, revision 증가로 동시 수정 거부 규칙 설계, 재승인 제공 | 실제 기존 Rules와 병합·배포 필요. 수정·audit의 서버 계약은 에뮬레이터 미실행 |
| 5 작품 업로드 | 기능 없음 | 기존 학생 페이지 내부 독립 폼, 텍스트/허용된 외부 링크 우선 제출, 필수 학교·활동코드·시설명·제목·유형·소개·파일, 선택 연결 ID, 진행률·취소·동일 작품 재시도. 이미지10MiB/영상100MiB/PDF20MiB. MIME·서명 검사 및 Rules MIME/용량 검사 | 직접 업로드 기본 비활성화. 사용자 화면에서 Spark 및 업그레이드 요구 확인. 버킷/CORS/토큰 정책 확인 필요. 자동 EXIF 제거·악성 파일 검사 미구현 |
| 6 작품 관리·전시 | 기능 없음 | 교사 미리보기/승인/반려/제목·소개 수정/비공개 전환. 승인 전 원본은 private 경로, 승인 시 별도 사본. 공개 페이지 승인 목록 및 학교·시설·유형 필터, 지도 핀 선택과 연결 | 실제 Storage 업로드·취소·권한·사본 회수 미실측. 내려받거나 캡처한 파일은 회수 불가 |
| 7 품질·보안 | Rules 검증 체계 없음 | 아래 로컬 검사·브라우저 fixture 통과. Emulator 테스트 코드 구현 | Emulator JAR 다운로드 도메인 차단으로 서버 Rules 검증 **미실행** |

### permission_denied 조사 경로

- 인증 전: Anonymous provider 비활성화, 네트워크/키 제한, Google popup 차단, 승인된 도메인 누락, 이메일 계정/비밀번호 오류는 **Auth 실패**입니다. DB 검증 오류와 다릅니다.
- 학생 저장: `/memoryTemperature2026/submissions/{S1..S7}/{auth.uid}/{entryId}`. 경로 UID와 auth.uid 불일치, 기존 규칙이 다른 루트·필드·학교 코드를 요구함, 필수 필드/타입/문자열 길이/좌표/점수 검증 거부는 모두 후보입니다. RTDB는 검증 실패도 권한 거부로 응답할 수 있어 클라이언트 에러 코드만으로 둘을 구별할 수 없습니다.
- 교사: `/submissions` 상위 읽기는 하위 학생 본인 읽기 허용만으로 허용되지 않습니다. 이메일 로그인 성공만으로 교사 승인이 되지 않습니다. 에뮬레이터 규칙 초안은 custom claim `teacher:true`와 `/memoryTemperature2026/teachers/{uid}:true`를 함께 요구합니다. 실제 UI 기본값 `TEACHER_AUTH_MODE=existing-rules`는 현재 이메일 기반 Rules의 submissions 읽기 성공을 통해 접근을 확인하므로 기존 계정에 새 claim을 일방적으로 요구하지 않습니다. 새 규칙으로 이행할 때만 claims-and-allowlist 모드로 바꿉니다.
- 공개지도는 `/published`만 읽습니다. 공개 작품은 `/publishedWorks`만 읽고 원본 `/works`를 읽지 않습니다. 공개 전 원본 경로를 공개 목록으로 복사하지 않습니다.
- 교사 수정은 submission·audit·published 세 곳의 atomic update 전체가 허용되어야 합니다. 일부 경로가 거부되면 전체 실패합니다.
- 지도 타일·Leaflet CDN·일반 지명검색·공식 API의 네트워크/CORS 오류는 DB 권한 오류와 별개입니다.

## 2. 개선 파일

- `index.html`: 학생 3단계 보존, 인지도 확정, 제출 오류·재시도, 독립 작품 영역 연결.
- `teacher.html`: Google/이메일 로그인 보존, 승인 검사·리스너 수명, 수정 dialog·audit·재검토, 작품 관리 연결. 기존 CSV 승인·삭제 유지.
- `public.html`: 기존 지도·통계 보존, 작품 갤러리 및 지도 핀 연계.
- `project-config.js`: 기존 설정 보존, 업로드 활성화 스위치만 추가.
- `upgrade-core.js`: 공통 검증·오류 분류·로그·공개 필드 선택.
- `official-facilities.js`, `official-facilities.json`: 검증 캐시 계약 및 검색 UI. 실제 시설 데이터를 만들어 넣지 않음.
- `media.js`: 비공개 파일 업로드 및 승인된 별도 사본·전시.
- `security/`: 배포하지 않은 RTDB/Storage 규칙 초안, 데모 프로젝트 에뮬레이터 설정, 테스트 및 이 문서.
- 저장소 `scripts/public-files.json`: 위 네 런타임 파일을 공개 빌드에 추가하는 데 필요한 변경만 수행. 다른 웹앱 수정 없음.

## 3. 실제로 실행한 검사

- 기존 Node 테스트 **8/8 통과** (happygeo/공개 경계 회귀).
- 신규 core 테스트 **4/4 통과**: 파일 제한값·형식·좌표, 미검증 캐시 배제/축 뒤집힘 거부, 오류 분류·외부 링크 프로토콜/호스트/자격정보 검증.
- 신규 Playwright fixture 통합 테스트 **1/1 통과**: 학생 학교 옵션 7개·3단계, 인지도 고정, 저장 권한 거부 후 작성 보존/동일 ID 재시도, 공식자료 불가 안내, 독립 작품 제출, 390px/1440px 학생 가로 넘침, 교사 수정/audit/공개 해제, e-GIS 첫 4열·수식 주입 방어, 교사 로그아웃 DB 리스너 3→0, 미승인 전시 제외·학교 필터. 추가로 업로드 기본 비활성화 상태에서 텍스트·외부 링크만 독립 제출하는 흐름을 검증했습니다.
- 런타임 JS 및 세 페이지 inline script 문법 검사 통과.
- 공개 빌드 **93개 파일** 및 manifest/바이트/로컬 참조 검사 통과. 실제 배포 아님.
- Emulator 테스트 **5개 정의, 0개 실행**: 7학교·소유자·비로그인·권한 없는 사용자, 원인지도, audit, 승인, Storage 용량·MIME·미승인 접근, 작품 metadata. CLI 설치 및 Java 확인 후 다운로드가 `403 Domain forbidden`으로 차단. 통과로 해석하면 안 됩니다.
- 브라우저 fixture는 SDK 대역입니다. 실제 Auth 서비스·실제 Rules 검증을 대체하지 않습니다. 7학교 운영 제출, 실제 기기간 동기화, 실제 파일 접근은 미검증입니다.

### 재현

권장 Node 22, Java 21 및 Chromium. 개발 환경의 Node 24에서는 CLI 의존성 engine 경고가 있었지만 실제 중단 원인은 다운로드 403이었습니다.

```sh
cd veteransgeo/security
npm ci
npm run test:core
# 기본 브라우저: /usr/bin/chromium. 다른 환경은 browser.test.cjs의 실행 경로 조정 필요.
npm run test:browser
# demo-veteransgeo만 사용; 운영 project ID로 바꾸지 마세요.
FIREBASE_EMULATORS_PATH=/tmp/veteransgeo-emulators XDG_CONFIG_HOME=/tmp/veteransgeo-config npm test
```

현재 환경에서 `mfis.mpva.go.kr`, `www.mpva.go.kr`, `storage.googleapis.com` 허용을 환경 설정 초안에 추가했습니다. 초안 저장과 현재 머신 적용은 다릅니다. 사용자가 환경 설정을 저장한 후 연결 재확인 → 에뮬레이터 검사 및 공식 API 조사를 재개해야 합니다. 기존 네트워크 preset은 유지했습니다.

## 4. Firebase Console에서 사람이 할 설정 (운영 게시 전 별도 승인)

1. [Realtime Database](https://console.firebase.google.com/project/school-project-26-1edf4/database)의 현재 Rules를 보존해 비교합니다. 이 폴더의 Rules는 **전체 운영 규칙 대체본이 아닙니다**. 다른 웹앱 루트가 있는 동일 DB를 통째로 덮어쓰면 다른 앱이 차단됩니다. 해당 루트만 병합하고 Emulator 통과·관리자 검토 후 별도 게시 승인을 받습니다.
2. [Authentication](https://console.firebase.google.com/project/school-project-26-1edf4/authentication/providers)에서 익명·Google·이메일 제공자 및 승인된 도메인을 확인합니다. GitHub Pages의 호스트는 `happygeo21.github.io`, Netlify는 실제 사이트 호스트입니다. 경로는 도메인 목록에 넣지 않습니다.
3. 서버 관리자만 교사 custom claim과 해당 UID allowlist를 설정합니다. 클라이언트에서 승인을 부여하지 않습니다. 현재 화면의 이메일 승인 목록은 임의로 삭제하거나 커밋하지 않습니다. claim 방식 도입은 기존 승인 교사 권한을 보존하는 별도 마이그레이션 검토가 필요합니다. Storage Rules는 RTDB allowlist를 참조할 수 없으므로 claim도 필요합니다. 교사 해제 시 claim 삭제·토큰 취소·재인증과 allowlist 해제를 함께 검토합니다.
4. [Storage](https://console.firebase.google.com/project/school-project-26-1edf4/storage) 버킷 존재와 실제 이름, [사용량/결제](https://console.firebase.google.com/project/school-project-26-1edf4/usage)의 요금제·예산·사용량을 확인합니다. 사용자 제공 Console 화면에서 Spark 무료 요금제 및 Storage 업그레이드 요구가 확인됐습니다. 버킷 존재 자체는 화면으로 확정하지 않았습니다. Spark를 유지하며 결제·요금제 전환을 하지 않습니다.
5. Storage CORS는 실제 Pages·Netlify origin과 인증 다운로드 방식으로 검증합니다. 공개 사본은 다운로드 token URL을 DB에 저장하지 않으며 `getBlob`으로 읽습니다. **Storage의 다운로드 토큰은 별도 bearer 권한이므로 실제 버킷의 생성/노출/회수 정책을 확인해야 합니다.** UI에서 getDownloadURL을 안 쓰는 것만으로 토큰 부재를 보장하지 않습니다. 공개 전 토큰 정책·미승인 파일 비인가 접근 테스트가 통과하기 전 기능을 활성화하지 마세요.
6. Storage Rules는 MIME·크기만 검사하며 실제 바이너리·EXIF·저작권을 판독하지 못합니다. 클라이언트 서명 검사도 우회할 수 있습니다. 학생 안내와 교사의 원본 검토가 필수이며 대규모 운영에는 서버 파일 검사·메타데이터 제거·업로드 할당량/속도 제한이 필요합니다.
7. `MEDIA_UPLOAD_ENABLED=true`는 위 검토 및 **테스트용 버킷 실측 후 별도 코드 리뷰로만** 변경합니다. 이번에는 false입니다.

## 5. 공식 API/캐시 검증 절차

사용자 제공 공식 문서 화면으로 JSON/XML URL을 확인했습니다. 문서의 HTTP 주소를 HTTPS 페이지에서 직접 fetch하면 혼합 콘텐츠 문제가 발생할 수 있으므로, 검증된 JSON 확보를 우선합니다. 키·HTTPS 지원·CORS·실제 좌표계는 미확정입니다.

안내: https://www.mpva.go.kr/mpva/contents.do?key=17
공식 지도: https://mfis.mpva.go.kr/servicemap/serviceMapMain.do

응답 원문·필드 명세·라이선스·호출 제한·CORS·키 노출 허용 여부를 확인해야 합니다. `xindex/yindex` 이름으로 축·단위를 추측하지 않습니다. 좌표계 명세를 확인한 후 알려진 시설 여러 곳을 공식 지도와 대조하고, 필요하면 명시적인 CRS 변환을 수행합니다. 비밀키가 필요하면 브라우저에 넣지 않고 별도 승인받은 서버 중계를 검토합니다.

캐시에는 `schemaVersion:1`, `status:verified`, `crs:EPSG:4326`, 확인한 `coordinateMapping`, `license`, `updatedAt:YYYY-MM-DD`가 필요합니다. 각 시설은 id/name/address/region/latitude/longitude/sourceUrl/verified를 가집니다. region은 기존 학교의 지역 표기를 사용하면 해당 학교에서 우선 표시됩니다. 출처 URL은 국가보훈부 호스트만 허용합니다. 빈 캐시를 검증된 실제 목록으로 표현하지 않습니다. 브라우저 API가 막히더라도 검증 캐시는 쓸 수 있지만 **이번에는 확보하지 못했습니다**.

## 6. 배포 환경·운영비·한계

- GitHub Pages는 allowlist `_site`를 배포하고 Netlify `veteransgeo/netlify.toml`은 해당 디렉터리 `.`을 게시합니다. 상대 JS/JSON 경로는 둘 다 유지됩니다. Netlify 실제 base/publish·도메인 및 Pages 배포 상태는 별도 확인이 필요하며 이번에는 실제 배포를 조회/변경하지 않았습니다.
- Netlify의 넓은 publish 범위는 `security/` 테스트 자료까지 제공할 수 있으므로 배포 준비 때 검증된 공개 artifact만 게시하는 설정을 검토하세요. 여기에는 키나 학생 자료가 없지만 검토 문서·개발 도구는 공개 대상에 넣지 않는 편이 좋습니다.
- Cloud Storage for Firebase는 Blaze 요구 정책이 적용되는 서비스입니다. 실제 계정 상태·이용 가능 여부·무료 할당량은 Console 및 https://firebase.google.com/docs/storage/faqs-storage-changes 에서 확인하세요. 결제/요금제 전환은 수행하지 않았습니다.
- 비용 후보: 파일 저장·다운로드 트래픽·요청, RTDB 저장/전송, 추가 서버 중계/검사. 영상100MiB 상한만으로 전체 비용·남용이 제한되지는 않습니다. App Check·사용자별 할당량·수명정책·예산 알림 검토가 남아 있습니다.
- 저비용 대안: 학교 승인 저장소/교육용 플랫폼에서 교사가 권한을 검토한 링크만 수집·전시. 단축/임의 URL·학생 원본 공개 링크 자동 수집은 피합니다. 임베드 쿠키·접근권한·링크 수명·개인정보를 검토해야 하므로 이번 UI에는 외부 링크는 Google Drive·문서·YouTube의 HTTPS 주소만 허용하며 자격정보·임의 포트·유사 호스트를 거부합니다. 원본 서비스 공개 여부는 이 앱의 승인과 독립적이며 교사 검토가 필요합니다. 텍스트만 제출하는 방식도 지원합니다.
- 교사 수정은 한 기록 단위 revision으로 충돌 방지를 설계했으나, 현재 검증되지 않은 서버 규칙 초안입니다. 승인 직전 다른 교사의 편집과 교차하는 상황 및 업로드 성공/DB 실패의 고아 파일 정리 정책은 추가 통합 검증이 필요합니다.

## 7. 배포 전 교사 체크리스트

- [ ] 공식시설 응답/좌표계/출처/이용 조건 검증 후 캐시 확보
- [ ] 기존 운영 Rules 백업·앱 루트별 병합 검토, Emulator 5개 테스트 실제 통과
- [ ] 테스트 프로젝트에서 7학교 익명 제출·권한 오류·동일 ID 재시도 및 기존 자료 호환 확인
- [ ] 승인·미승인 교사, 학생, 비로그인 계정으로 RTDB/Storage 접근 실측
- [ ] 교사 수정 시 원인지도 보존·audit·동시 수정 충돌·공개 해제·재승인 확인
- [ ] 버킷/요금제/예산/CORS/토큰 정책, 미승인 원본 공개 불가 확인
- [ ] 이미지·영상·PDF 경계 크기, 잘못된 MIME/실제 바이너리, 실패·취소·재시도 확인
- [ ] 공개 작품 필터/지도 핀 연결, 비공개 전환 사본 삭제와 재접근 차단 확인
- [ ] 얼굴·실명·연락처·EXIF·저작권 검토, 실제 학생 개인정보를 테스트에 사용하지 않기
- [ ] 교사/공개페이지 모바일·PC 실제 CDN 연결 확인, CSV 기존 열/수식 방어 재확인
- [ ] Pages/Netlify 각각 독립 검증, 별도 배포 승인 후에만 적용

## 8. PR·롤백·기록

검토 브랜치의 PR 생성 결과는 최종 보고에 표시합니다. PR이 생기더라도 위 미완료 항목 때문에 Draft로 유지하고 병합하지 않습니다. main 변경·운영 Rules 게시·실제 배포는 수행하지 않았습니다.

현재 운영 롤백은 필요 없습니다. 코드 리뷰 중 취소하려면 PR을 닫고 브랜치를 보존하면 됩니다. 향후 승인 후 배포했다가 되돌릴 때는 merge commit을 revert하는 별도 PR로 기존 세 페이지와 공개 manifest를 함께 복원하고, Rules는 사전 백업한 해당 루트 규칙으로 별도 검토 후 복원합니다. 데이터 루트 삭제·리셋은 하지 않습니다. 공개 작품 회수는 목록뿐 아니라 승인 사본 파일도 제거해야 합니다.

Notion 기록은 이번 요청에 외부 쓰기 지시가 없어 수행하지 않았습니다. 작업 시각과 커밋은 git 기록을 기준으로 확인합니다. 추가할 문안: “기억의 좌표 LIVE 업그레이드 검토 초안 / codex/veteransgeo-upgrade / 운영 배포·DB 변경 없음 / 학생 복구·교사 수정·작품 흐름 구현 / 공식 실데이터·운영 설정·Emulator 검증 대기 / 업로드 기본 비활성화 / 다음: Console 확인 및 네트워크 적용 후 검증 / Notion 미반영”. 커밋 SHA와 KST 시각은 최종 보고에서 함께 기록합니다.

최종 로컬 검증 시각: 2026-10-29 10:58 KST. PR/커밋의 정확한 시각과 SHA는 Git 기록 및 최종 보고를 참조합니다.
