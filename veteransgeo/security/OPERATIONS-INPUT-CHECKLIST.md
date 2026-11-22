# PR #7 운영 자료 수집표와 테스트 연결 절차

**판정: 신규 기능의 운영 수업 적용 보류. 추가 기능 개발 대신 아래 ‘사용자 확인 필요’ 자료를 기다립니다.**

2026-10-29 KST 작성. [PR #7](https://github.com/happygeo21/school-web-projects26/pull/7)은 Draft입니다. 이번 결과물은 문서 정리이며 main 병합, 운영 Rules 게시, 실제 배포, 계정 권한·운영 데이터·Storage·Blaze 변경을 수행하지 않습니다. 테스트 프로젝트 생성/설정도 아래에 적은 **사람이 수행할 계획**이며 실행 완료가 아닙니다.

기준 문서: [RELEASE-PREFLIGHT.md](RELEASE-PREFLIGHT.md), [RULES-MIGRATION.md](RULES-MIGRATION.md), [4차 검토](PR7-FINAL-REVIEW.md). 이 수집표가 이후 확인 현황의 시작점입니다. 과거 CI 통과는 운영 검증 완료를 뜻하지 않습니다.

## 1. 한눈에 보는 정보 수집표

체크는 실제 화면/파일을 확인한 뒤에만 표시합니다. 버튼 이름은 Console 언어와 UI 개편에 따라 한글/영문으로 다르게 표시될 수 있습니다. ‘공유 가능’도 PR에 자동 게시한다는 뜻이 아닙니다.

| 수집 | 대상·현재 상태 | 어디를 클릭하나요? | 남길 증거·공유 범위 |
|---|---|---|---|
| [ ] F1 | **사용자 확인 필요:** 게시된 전체 운영 RTDB Rules 원문 | Firebase Console → `school-project-26-1edf4` → Build/빌드 → Realtime Database → 인스턴스 선택 → **Rules/규칙** | 전체 파일은 저장소 밖 비공개 보관. 프로젝트/DB 인스턴스, 게시본 여부, 확인 KST, SHA256, 복구용 사본 존재 여부만 공유 |
| [ ] F2 | **사용자 확인 필요:** 최상위 권한·다른 앱 루트·경로별 교사 승인식 | F1 원본을 비공개로 열어 `.read/.write/.validate/.indexOn`, `memoryTemperature2026`, 다른 루트 확인 | submissions 읽기/쓰기·published 쓰기의 승인 목록이 같은지, 추가 하위 규칙 유무. 이메일/UID 목록·전체 표현식은 비공개 |
| [ ] F3 | **사용자 확인 필요:** 실제 인증 제공자 | Authentication → **Sign-in method/로그인 방법** | Anonymous/익명, Google, Email/Password 활성 여부만. 사용자 목록·비밀번호·토큰 수집 불필요 |
| [ ] F4 | **사용자 확인 필요:** 실제 승인 도메인 | Authentication → **Settings/설정 → Authorized domains/승인된 도메인** | 기존 Pages/운영 Netlify 및 preview 호스트별 등록 여부. 도메인 추가/삭제하지 않음 |
| [ ] F5 | **사용자 확인 필요:** 별도 테스트 프로젝트 | Firebase Console 프로젝트 선택기 → 테스트 프로젝트가 있으면 선택 → **Project settings/프로젝트 설정 → General/일반** | 실제 projectId와 별도 DB 호스트, 운영과 다름을 확인. 프로젝트가 없으면 ‘없음’이라고 기재 |
| [ ] F6 | 확인된 과거 자료: Spark, Storage 업그레이드 요구. 최신 상태는 **사용자 확인 필요** | **Usage and billing/사용량 및 결제** 및 **Storage** | 요금제와 버킷 확인 가능 여부만. Upgrade/업그레이드·Get started/시작하기·결제 연결은 누르지 않음 |
| [ ] N1 | **사용자 확인 필요:** 두 Netlify 사이트의 운영 배포 기준 | Netlify → Projects → `veteransgeo`, `happygeo` 각각 → **Deploys → Published** | 운영 URL, deploy ID, 커밋 SHA, 배포 시각. PR #7 preview와 별도 기록 |
| [ ] N2 | **사용자 확인 필요:** 실제 빌드/연결 설정 | 각 사이트 → **Project configuration → Build & deploy → Continuous deployment** | 연결 repo·production branch·base·build command·publish·설정 파일 경로·main 자동 배포 여부 |
| [ ] N3 | **사용자 확인 필요:** preview 산출물의 Firebase 대상 | **Deploys → PR #7 Deploy Preview → Deploy file browser** | `firebase-config.js`를 정적 파일로 확인. projectId·databaseURL 호스트만 기록. 학생 HTML을 실행하지 않음. 키 원문 공유 금지 |
| [ ] N4 | **사용자 확인 필요:** preview 401의 접근 보호 설정 | **Project configuration → Access & security → Visitor access / Deploy protection / Password protection**에 해당하는 메뉴 | 보호 종류와 적용 범위(Production/Deploy Previews), 승인된 열람 계정의 접근 결과. 보호 해제·비밀번호/쿠키 공유 금지 |
| [ ] N5 | **사용자 확인 필요:** 배포 로그·실제 공개 파일 경계 | 해당 Preview의 **Deploy log**, **Deploy file browser** | 커밋·성공/실패 단계, `security/`, Rules, package, node_modules 제외 여부. 인증 없는 401만으로 제외 판정하지 않음 |
| [ ] N6 | **사용자 확인 필요:** 환경변수 적용 범위·기존 주소 | **Project configuration → Environment variables**, **Domain management / Domains** | 변수명·context(Production/Deploy Previews)만, 값/비밀키 제외. 기존 주소·custom domain 유지 여부 |
| [ ] R1 | **사용자 확인 필요:** 코드와 Rules를 함께 되돌릴 복구 지점 | GitHub → **Actions → Pages 실행**, Netlify → **Deploys → Published**, Firebase → **Rules** | 기존 Pages SHA/실행, Netlify deploy ID 두 개, 비공개 Rules 백업 해시·보관 위치. 복구 버튼을 실행하지 않음 |
| [ ] O1 | **사용자 확인 필요:** 공식 시설 원자료와 이용 조건 | [국가보훈부 공식 API 안내](https://www.mpva.go.kr/mpva/contents.do?key=17) → 실제 제공 다운로드/담당 부서 문의 | 공식 JSON/CSV·출처 URL·갱신일·재사용 조건·좌표계·필드/축 순서·지도 대조. 파일이 없으면 ‘미확보’. [반입 절차](FACILITY-IMPORT.md) 참고 |

운영 Rules 전체 원문이 없으면 **실제 병합본 생성/컴파일/호환 검증은 모두 미완료**입니다. 일부 스크린샷이나 합성 이메일 CI 결과로 체크하지 않습니다. 운영 자료를 학생 데이터 export로 대신하지 않습니다. 이 단계에서 학생 레코드를 열거나 다운로드할 필요가 없습니다.

### 개인정보 없이 전달할 답변 양식

```text
확인 시각(KST):
F1 전체 게시 Rules 비공개 백업: 있음/없음, SHA256, 보관 경로(원문 첨부 금지)
F2 전역 권한/다른 루트/교사 승인식 차이: 비공개 검토 필요/확인됨(차이 유무만)
F3 익명 / Google / 이메일 활성: 각각 예/아니오/미확인
F4 Pages / 운영 Netlify / 각 Preview 도메인 등록: 각각 예/아니오/미확인
F5 테스트 projectId / DB 호스트: 없음 또는 실제 값(키·계정 목록 제외)
F6 Spark 유지 / Storage 상태: 확인 결과만
N1~N2 각 사이트: 운영 URL / Published ID·SHA / base·build·publish / production branch
N3 각 preview: 정적 설정 projectId / DB 호스트 / 확인 불가
N4 보호 종류·범위 / 승인된 계정 정적 파일 접근: 가능/불가/미확인
N5 배포 로그 성공 여부 / security 등 artifact 제외: 확인/미확인
N6 context 구분·기존 주소 유지: 확인/미확인(환경변수 값 제외)
R1 이전 웹 두 사이트·Pages + Rules 복구 지점: 확보/미확보
O1 공식 자료·좌표 명세·재사용 조건: 확보/미확보
```

## 2. HTTP 401: 배포 실패와 접근 보호를 구분하는 순서

기존 [정적 점검 CI](https://github.com/happygeo21/school-web-projects26/actions/runs/40811396395)에서 두 preview의 홈과 설정 파일 GET은 401이었습니다. 현재 작업 머신의 CONNECT 403은 별도의 클라우드 네트워크 제한이며 이 401과 같은 원인으로 취급하지 않습니다. 해당 CI의 Success는 점검 완료이지 앱 정상 동작 판정이 아닙니다.

1. 로그인한 Netlify 관리 화면에서 PR #7 배포의 SHA·context와 Deploy log를 확인합니다. 빌드 실패/산출물 누락이면 배포 문제를 별도로 기록합니다. 과거 성공 배포와 현재 PR head를 혼동하지 않습니다.
2. N4에서 보호 종류·적용 context를 **보기만** 합니다. 승인된 관리자에게도 볼 권한이 없으면 여기서 중지하고 ‘사용자 확인 필요’로 남깁니다.
3. 승인된 관리자가 기존 정상 로그인으로 Deploy file browser에서 정적 파일을 확인합니다. 보호를 통과한 정적 응답이 200이면 앞단 접근 보호 가능성이 높습니다. 이것만으로 Firebase 저장/권한 성공을 판정하지 않습니다.
4. 관리 화면의 설정·응답 근거가 없거나 정상 승인된 접근에서도 401이면 원인 미확정입니다. Netlify 접근 정책/인증 로그 또는 프로젝트 담당자의 확인이 필요합니다. 비밀번호·세션 쿠키·토큰을 받아서 재현하지 않습니다.
5. `security/`가 artifact에서 빠졌는지 별도로 확인합니다. 401은 모든 경로를 가릴 수 있으므로 ‘보호 뒤 404 확인’과 다릅니다. Firebase 대상 분리 전 학생/교사/공개 앱을 실행하지 않습니다.

접근 보호 해제, 인증 우회, 운영 Firebase Auth에 preview 도메인 추가를 문제 해결책으로 사용하지 않습니다. Google 승인 도메인이 없더라도 익명 인증/DB 쓰기를 안전하게 차단한다고 가정할 수 없습니다.

## 3. 테스트 Firebase 연결 — 운영 설정 파일을 건드리지 않는 절차

**실행 상태: 계획, 사용자 확인 필요.** 테스트 프로젝트가 없으므로 이번에 연결/실측하지 않았습니다. 테스트 인프라 준비와 가상 자료 검증만을 위한 절차이며 운영 전환 승인이 아닙니다. Storage는 만들지 않고 Spark를 유지합니다.

### 3-1. 별도 프로젝트 준비 (교사)

1. Firebase Console 프로젝트 선택기 → **Add project/프로젝트 추가**. 테스트임을 표시한 이름으로 만들고 실제 부여된 ID를 기록합니다. 기존 테스트 프로젝트가 있으면 먼저 소유자/사용 범위를 확인합니다. 프로젝트 ID가 `school-project-26-1edf4`이면 중단합니다. 결제/Blaze 연결은 하지 않습니다.
2. 새 테스트 프로젝트의 **Project settings → General → Your apps → Web(</>)** → 앱 등록. Firebase Hosting 설정은 선택하지 않습니다. Web 설정 객체를 **저장소 밖 비공개 파일**에 보관하고 서비스 계정/관리자 키는 생성하지 않습니다.
3. 테스트 프로젝트 → **Realtime Database → Create Database/데이터베이스 만들기** → 리전 선택 → 잠금 모드(**Start in locked mode**). 기본 전면 공개 test mode는 사용하지 않습니다. 해당 인스턴스의 실제 databaseURL을 확인해 테스트 Web 설정에 사용합니다.
4. 테스트 프로젝트 → **Authentication → Get started → Sign-in method** → Anonymous·Email/Password를 테스트에 필요한 범위에서 활성화합니다. **Users → Add user**로 승인용/미승인용 가상 교사 계정을 준비하고 비밀번호를 공유하지 않습니다. Google 검증은 전용 관리형 테스트 계정과 Google 제공자 설정이 준비된 때에만 별도로 합니다. 실제 학생 계정은 쓰지 않습니다.
5. **Authentication → Settings → Authorized domains → Add domain**에서 테스트 웹의 정확한 호스트만 추가합니다(로컬은 `localhost`, 별도 preview는 그 테스트 호스트). 신규 프로젝트는 localhost가 기본 등록되지 않을 수 있습니다. **운영 프로젝트 도메인은 변경하지 않습니다.**
6. F1 확보 후 비공개 검토한 Rules의 **테스트 전용 파생본**을 만듭니다. 구조·상위 권한은 비교하되 승인 이메일만 가상 계정으로 치환하고 운영 이메일 목록은 테스트 프로젝트/로그에 올리지 않습니다. 기존 이메일 방식 유지, claim 방식 무단 도입 금지입니다. Emulator 통과 후 테스트 프로젝트 ID/DB를 다시 확인하고 테스트 Rules만 적용합니다. 운영 Rules 원문이나 claim 후보 JSON을 그대로 게시하지 않습니다. F1이 없으면 합성 후보 실험까지만 가능하며 실제 병합 검증은 대기합니다.

### 3-2. 로컬 웹 복사본에만 연결 (개발자/담당 교사)

1. 테스트할 PR head SHA를 기록합니다. 저장소 밖 새 임시 소스 복사본을 만들고, 거기서 기존 `node veteransgeo/security/build-netlify.mjs`로 allowlist 산출물 13개를 만듭니다. 기존 산출물을 임의 삭제하지 않습니다. `security/`나 전체 저장소를 웹서버의 document root로 쓰지 않습니다.
2. 임시 소스의 `veteransgeo/_public`을 다시 비공개 `test-web` 폴더로 복사합니다. **그 폴더의 `firebase-config.js`만** 테스트 객체로 교체합니다. 작업 브랜치의 tracked 파일, 기존 `_site`/`_public`, 운영 Netlify 파일은 수정하지 않습니다. 수정 전후 `git diff -- veteransgeo/firebase-config.js`가 비어 있는지 확인합니다.
3. 이 앱의 모듈 형식은 아래와 같습니다. `<…>`는 실제 테스트 값으로 교체하되 PR/문서에 키를 붙여넣지 않습니다. Console Web 설정의 필수 필드를 유지하고 생성한 테스트 RTDB URL을 추가합니다. `DB_ROOT`는 동일하게 유지해 경로 호환성을 검사합니다.

```js
// 저장소 밖 test-web/firebase-config.js 에만 작성. 미완성 값으로 앱을 열지 않습니다.
export const firebaseConfig = {
  apiKey: "<테스트 Web 설정의 값>",
  authDomain: "<테스트 authDomain>",
  projectId: "<테스트 projectId>",
  databaseURL: "<테스트 인스턴스의 정확한 HTTPS URL>",
  appId: "<테스트 Web appId>"
};
export const DB_ROOT = "memoryTemperature2026";
```

4. 브라우저 실행 **전에** 임시 설정을 정적으로 검토합니다. projectId는 승인된 테스트 ID와 같고, DB 호스트는 테스트 인스턴스와 정확히 같아야 합니다. 운영 ID/DB 호스트가 남아 있거나 값 누락/불일치이면 중단합니다. `MEDIA_UPLOAD_ENABLED=false`, 교사 existing-rules 모드도 확인합니다. 백엔드가 운영으로 fallback하는 구성을 쓰지 않습니다.
5. 테스트 전용 브라우저 프로필을 쓰고 운영 DB 호스트에 대한 요청을 차단합니다. Chromium DevTools의 **Network request blocking** 등에서 운영 RTDB 호스트 및 Firebase REST의 운영 프로젝트 경로를 차단한 뒤 **모든 테스트 탭에 적용됐는지** 확인합니다. 탭 하나의 차단 설정을 다른 탭 전체의 보호로 가정하지 않습니다. 차단은 추가 방어이며 4번 정적 설정 확인을 대체하지 않습니다.
6. `test-web` 폴더에서 로컬 서버를 localhost에만 바인딩합니다. 예: `python3 -m http.server 8765 --bind 127.0.0.1`. `http://localhost:8765/`를 테스트 프로필에서 엽니다. 이 페이지부터 익명 인증이 시작될 수 있습니다. Network의 DB 요청 호스트·Auth 요청 project 설정이 테스트 대상인지 확인하고 차이가 있으면 창을 닫고 테스트를 중단합니다. Firebase app 객체가 전역 변수라고 가정하지 않습니다.
7. 승인/미승인 교사와 익명 학생은 각각 분리된 테스트 세션을 사용합니다. 테스트 프로젝트 Console에서만 가상 레코드와 ACK를 확인합니다. 일반 운영 탭을 테스트로 재사용하지 않습니다. 운영 레코드 export/import 없이 가상 legacy 기록을 별도로 만듭니다.

### 3-3. Netlify preview에 연결하려면 (미실행·추가 준비 필요)

현재 `build-netlify.mjs`는 파일을 복사할 뿐 환경변수를 읽어 Firebase 설정을 생성하지 않습니다. **Environment variables에 테스트 값을 넣는 것만으로 분리 완료가 되지 않습니다.** 현 preview는 운영 연결 가능 상태로 취급합니다.

- 우선 위 로컬 테스트를 사용합니다. 별도 테스트 웹 호스팅이 필요하면 기존 운영 사이트의 Production 설정을 수정하지 않는 테스트 전용 프로젝트/배포안과 승인을 먼저 마련합니다. 이번 작업에서는 새 사이트 생성·preview 재배포도 하지 않습니다.
- 향후 기존 preview를 쓴다면 Netlify **Project configuration → Environment variables → Add a variable**에서 **Deploy Previews context에만** 테스트 값을 두고, 별도 검토한 빌드 오버레이가 **산출물의** 설정만 생성해야 합니다. 현재 그런 오버레이는 구현/적용하지 않았습니다.
- 오버레이는 테스트 값 누락·운영 projectId/DB 호스트 발견 시 실패해야 하며 운영 설정 fallback 금지입니다. artifact 정적 검사 통과 전 공개/실행하지 않습니다. 이전 preview가 남을 수 있어 접근 보호도 유지합니다.
- `happygeo`는 다른 설정 모듈 형식/별도 앱 루트입니다. veteransgeo 오버레이를 두 사이트에 일괄 적용하지 않습니다. happygeo는 현상 유지하며 동일 프로젝트 공유에 따른 영향 확인만 받습니다.

## 4. awarenessOriginal 충돌 검증 계획

**미실행:** 현재 운영 전체 Rules 원문과 테스트 프로젝트가 없습니다. CI의 합성 이메일/claim Emulator 통과와 아래 계획을 구분합니다. 기존 20필드와 신규 추가 필드는 [4차 검토](PR7-FINAL-REVIEW.md)의 목록을 기준으로 합니다.

F1 확보 → 비공개 원본 해시/권한 비교 → 실제 후보의 로컬 Emulator 컴파일 → 가상 승인식 파생본 검증 → 별도 테스트 프로젝트 실측 순서입니다. 운영 원문·실제 교사 목록은 공개 CI/artifact에 넣지 않습니다. 현재 `npm test`는 자체 합성 규칙만 읽으므로, 실행만으로 F1 원문이나 실제 병합본을 검증했다고 표시하지 않습니다.

| 검사 조합/요청 | 별도 테스트 프로젝트의 가상 입력 | 기대 결과·판정 기준 |
|---|---|---|
| 구형 코드 + 기존 Rules 파생본 | main 기준 구형 웹의 20필드, awarenessOriginal 없음 | 원문 허용 조건과 결과 대조. 제출 성공을 사전 가정하지 않음 |
| 구형 코드 + 신규 strict 파생본 | 다른 입력 조건은 모두 유효하고 원인지도만 없는 **새 ID/존재하지 않는 경로** | 생성 거부가 예상됨. 기존 레코드 재시도와 혼동하지 않고 거부·초안 유지 확인 |
| 신규 코드 + 기존 Rules 파생본 | schemaVersion/awarenessOriginal/facilityId가 있는 신규 입력 | 추가 필드/검증식에 따른 허용·거부 기록. works/audit는 따로 판정 |
| 신규 코드 + 신규 병합 파생본 | 7학교·본인 UID·유효 좌표·최초 사전 응답 | 서버 ACK·학교별 1건. 같은 ID+동일 payload 재시도는 1건 유지 |
| 위변조/경계 | 다른 UID·없는 학교·타입/좌표 오류·원인지도 점수/시각 변경·신규 필드 누락 | 학생 타인 접근/덮어쓰기·인지도 변경 거부. Auth 성공과 DB 검증 거부를 별개 기록 |
| 교사·legacy | 가상 기존 자료(원인지도 없음), 승인/미승인 교사 | 승인 교사 수정/이력/승인·해제/복원, 원인지도 소급 생성 없음. 오래된 revision 거부. 승인식 차이 보존 |
| 신규 경로·공개 | works/audit/workAudit/publishedWorks와 승인 사본 | 미승인 공개/학생 승인·audit 읽기 차단, 승인 사본 비식별화, 기존 다른 루트 권한 보존 |

각 조합마다 테스트 프로젝트/DB·Rules 파생본 해시·웹 SHA·KST·역할·학교·기대값/실제값·개인정보 없는 오류 코드·건수만 기록합니다. ID/토큰/이메일 원문 로그는 남기지 않습니다. 구형/신규 웹은 별도 임시 폴더·브라우저 세션을 사용하며 두 복사본 모두 테스트 설정인지 실행 전에 확인합니다.

구형 생성만 한시 허용하는 bridge는 검토안일 뿐 구현/통과/운영 승인 상태가 아닙니다. 학생 읽기/덮어쓰기 권한을 넓히지 않고 만료·원자료 미측정 분리까지 검증해야 합니다. 필드 생략으로 구형인 척할 수 있으므로 완전한 신규 측정 보장은 못 합니다. 실제 원문 기반으로 안전한 이행이 불가능하면 수업 외 점검 시간에 Rules와 웹을 함께 전환하는 기존 계획을 사용합니다. 운영 전환은 별도 승인 후입니다.

## 5. 현재 사용할 수 있는 범위

| 구분 | 기능 | 사용 조건 |
|---|---|---|
| 현재 운영 유지 대상 | 기존 main의 3페이지·학생 3단계·7학교·기존 승인/CSV | 기존 운영 상태 유지. 이번에 실제 운영 제출을 재검증한 것은 아님 |
| 현재 가능한 준비/격리 검토 | 공식지도 외부 참고, 수동 장소 관찰·기록지, 가상 자료 UI/CSV·모바일·초안 복구 검토 | 신기능을 운영 수업에 배포한 상태가 아님. 저장 기능 리허설은 위 테스트 연결 후만 가능 |
| 개발 검증 완료·운영 미적용 | 동일 ID 재시도·오류 안내, 교사 수정/이력/보관/복원 UI, 독립 아이디어·링크, 공개 갤러리/필터/핀 연계 | 기존 CI의 core9·브라우저 대역1·Emulator 두 방식 각6 시나리오 근거. 실제 Firebase 실측과 구별 |
| 운영 자료·적용 필요 | 신규 제출 서버 검증, 교사 수정·승인, works/audit/workAudit/publishedWorks 저장·공개 | F1~F5·N1~N6·R1 확보, 실제 후보 및 테스트 프로젝트 통과, 별도 운영 전환 승인 필요 |
| 보류 | 공식 목록 자동검색의 실데이터, 파일 직접 업로드 | O1 미확보로 캐시 비어 있음. 직접 업로드 false 유지, Storage/Blaze/비용·인프라 검토는 이번 범위 밖 |

## 6. 중지 조건과 다음 작업

지금 반드시 필요한 세 가지는 **전체 게시 Rules 비공개 백업**, **두 preview의 정적 Firebase 대상·401 보호 설정 확인**, **별도 테스트 프로젝트 및 복구 기준 확보**입니다. 미확보 항목은 ‘사용자 확인 필요’로 두며 기능 추가·운영 DB 테스트로 대신하지 않습니다.

교사 정보 수집 → 기존 승인/다른 앱 루트 보존 비교 → Emulator/별도 테스트 프로젝트 검증 → 전환 범위/시각 승인 → 수업 외 동시 전환 순서입니다. 마지막 두 단계는 이번에 실행하지 않습니다. 실패 복구는 이전 웹 버전과 **해당 앱의** 이전 Rules를 함께 되돌리는 [기존 절차](RELEASE-PREFLIGHT.md#7-복구-계획)를 따르고, 다른 앱의 최신 규칙·학생 데이터는 유지합니다.

Notion 미반영: 이번 요청은 기존 PR/검토 문서 정리이며 외부 Notion 쓰기를 수행하지 않았습니다. 추가 문안: “기억의 좌표 LIVE PR #7 운영 자료 수집표 정리 / Draft 유지 / 전체 게시 Rules·preview 정적 설정/401 보호·별도 테스트 프로젝트는 사용자 확인 필요 / awarenessOriginal 4조합 검증과 로컬 테스트 설정 분리 절차 작성 / 운영 적용 보류 / main·운영 Firebase·배포·Storage·Blaze 변경 없음”. 커밋 SHA/KST는 Git 기록과 최종 보고를 함께 기재합니다.
