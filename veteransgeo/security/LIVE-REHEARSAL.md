# 7차: 생성된 테스트 프로젝트 — 비공개 설정과 관리 연결 대기

2026-10-29 KST 재검토. 사용자가 테스트 Firebase `veteransgeo-test-2026`(Spark, 싱가포르 RTDB, 익명/이메일·가상 교사 2계정·localhost 설정)와 전용 Supabase Free 프로젝트의 비공개 버킷/SQL/RLS/함수 적용을 확인했습니다. **이 정보는 사용자 확인 결과이며 이 환경의 관리 API 실측은 아닙니다.** SQL·버킷·프로젝트를 다시 만들거나 migration을 재실행하지 않았습니다. 운영 전체 Rules는 여전히 미제공이며 별도 테스트 시작의 필수 조건은 아닙니다.

## 이번 실행 결과와 실제 차단 지점

- 원격 main `c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5`, 시작 개발 head `16ea843c7caed741d470d0208d2a2714eec1667b`. PR #7 Draft 유지. 이번에도 운영 Firebase/Rules/학생 데이터/웹 설정/Netlify/Pages/요금제 변경 없음.
- 연결된 Firebase/Supabase 관리 도구·준비된 서비스 자격증명·outbound identity가 없습니다. 테스트 프로젝트의 존재를 부정하지 않으며, 현재 실행기의 관리 접근과 비공개 입력이 부족하다는 뜻입니다.
- 실제 테스트 Edge의 `GET ?action=readiness`와 운영 Pages의 정적 GET: **프록시 CONNECT 403, origin HTTP 000**. Edge 401/404·Firebase 권한 거부·서비스 장애를 확인한 응답이 아닙니다. 운영 DB/Auth 요청은 하지 않았습니다.
- 환경 초안에 기존 허용 목록을 보존하면서 테스트 Supabase 호스트, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `www.gstatic.com`, `happygeo21.github.io`를 추가 저장했습니다. **초안 저장만 완료**, 현재 런타임 적용/환경 게시와 다릅니다. 환경 설정에서 검토·저장 후 Publish가 필요하다는 도구 응답을 받았습니다. 실제 DB URL 확인 후 그 정확한 호스트도 허용해야 합니다. 프록시/TLS/인증을 우회하지 않습니다.
- core 9개, 기존 브라우저 1개, 준비·연결 보호 10개, 기존 미디어 7개 로컬 검사 통과. 변경 후 서버 키/Range/무토큰 거부 관련 7개 계약 검사도 통과했습니다. 겹치는 검사를 별도 성공 건수로 합산하지 않습니다.
- `npm test`: 로컬 Emulator JAR 다운로드 단계 실패, Rules 시나리오 **미실행**. 기존 CI의 demo 프로젝트 Emulator 통과와 이번 로컬 실패를 구분합니다. 테스트 Firebase Rules 적용은 **미실행**입니다.
- Edge 진입점 Deno 타입 검사 통과. 최신 Supabase 공식 [Secrets 문서](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/secrets.mdx)와 [인증 헤더 문서](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/auth-headers.mdx)를 확인했습니다. 현재 `SUPABASE_SECRET_KEYS` JSON의 `default` 서버 키와 legacy `SUPABASE_SERVICE_ROLE_KEY`를 지원하도록 보완했습니다. 새 secret은 `apikey`에, legacy service_role JWT는 기존 두 헤더에 보냅니다. 잘못된/누락된 서버 키·anon 키는 중단하며 값은 로그/클라이언트/readiness로 보내지 않습니다. 실제 키 주입/서버 응답 검증은 아직 미실행입니다. 사용자 정의 `SUPABASE_*` Secret을 만들라고 안내하지 않습니다(예약 접두어).
- 기존 프로토콜 실행기에 **무인증 업로드 거부, 승인 파일 Range 206/바이트 비교, 승인 해제 후 Range 403**를 추가했습니다. 이것은 실행 준비이며 실제 서버 결과가 아닙니다. Firebase JWT 서명/issuer/audience/시간/sub 검증과 운영 차단은 유지했습니다.

## 저장소 밖 실제 입력 파일 — 준비했지만 불완전

`/workspace/private-veteransgeo/live-7/config.json`을 기존 예시에 기반해 만들었습니다. 폴더 0700·파일 0600, 저장소 밖 경로를 확인했습니다. 알려진 프로젝트 ID, Supabase URL/endpoint, localhost 주소를 반영했고 **S1~S7의 새 무작위 테스트 코드 7개**를 생성해 이 파일에만 보관했습니다. 예시 파일 자체를 실제 설정으로 사용하지 않았고, 기존 파일도 덮어쓰지 않았습니다.

미확인 9개 값은 `null`: 프로젝트 번호, Web `apiKey`/`appId`, 승인/미승인 가상 교사 각각 UID·이메일·비밀번호입니다. authDomain은 해당 프로젝트의 기본 도메인으로 채웠습니다. DB URL은 기본 인스턴스 명명 규칙에 따른 값을 넣었지만 **Console의 실제 URL과 대조 전에는 확인 완료가 아닙니다**. 별도 `input-status.json`에 이 확인 대기 상태를 남겼습니다. 활동코드는 이미 생성됐으므로 사용자가 다시 고르거나 채팅에 전달할 필요가 없습니다.

**불완전한 config로 `live:prepare`/`live:probe`/`live:protocol`을 실행하지 않았습니다.** 완성된 test-only.rules.json·서버 Secrets·test-web도 아직 생성되지 않았습니다. 승인 교사 UID를 추정한 가짜 후보나 운영 병합본을 만들지 않았습니다.

### 민감정보 입력 방법

채팅·PR·스크린샷·일반 업로드에 비밀번호/토큰/서비스 키를 보내지 않습니다. 현재 도구에서 사용자 전용 비공개 편집/파일 전달 채널을 확인하지 못했으므로 **로컬 Codex/WSL의 신뢰할 수 있는 터미널**에서 준비하는 방법을 우선합니다. WSL은 `/mnt/c` 대신 Linux 홈 아래 private 폴더를 사용합니다.

이 작업 머신에는 `/workspace/private-veteransgeo/live-7/complete-config.py`(0600)를 준비했습니다. 이 도우미 자체에는 비밀값이 없습니다. 준비된 private config와 도우미를 안전한 파일 이동 수단으로 로컬 private 폴더에 보관하거나, 기존 예시와 아래 알려진 대상 정보를 로컬에서 반영합니다. 실제 비공개 파일을 Git에 커밋하지 않습니다.

```sh
umask 077
mkdir -p "$HOME/.local/share/veteransgeo-live"
chmod 700 "$HOME/.local/share/veteransgeo-live"
# private config.json/complete-config.py를 위 폴더로 보관한 후 실행
chmod 600 "$HOME/.local/share/veteransgeo-live/config.json"
python3 "$HOME/.local/share/veteransgeo-live/complete-config.py" "$HOME/.local/share/veteransgeo-live/config.json"
```

도우미는 키·계정 정보를 `getpass`로 입력받아 화면/명령 인자/셸 이력에 출력하지 않습니다. 실제 DB URL을 Console에서 붙여넣어야 합니다. 터미널이 없으면 입력을 거부하며 기존 파일을 유지합니다. Python 문법과 비대화식 거부를 확인했으며, 실제 값 입력은 실행하지 않았습니다. 입력 완료 후 같은 저장소의 Node `readLiveConfig` 검증을 통과해야 하며, 저장만으로 서버 연결 성공이 아닙니다. 파일/폴더 권한·저장소 경계를 바꿔 우회하지 않습니다.

확인 위치는 Firebase 테스트 프로젝트 → **프로젝트 설정 → 일반 → 프로젝트 번호 / 내 앱 → SDK 설정 및 구성 → 구성**(apiKey/appId), **Realtime Database → 데이터** 상단 URL, **Authentication → Users**(두 가상 UID)입니다. 비밀번호는 Console에서 조회할 수 없으므로 생성 시 보관한 가상 비밀번호를 로컬에서 입력합니다. 서버 키는 config.json에 넣지 않습니다.

## 입력 완료 후의 다음 실행 — 순서 유지

1. `live:prepare -- --config PRIVATE/config.json --out PRIVATE/prepared-새이름` 실행. 원본 웹 설정은 수정하지 않습니다.
2. 생성된 테스트 후보를 Emulator로 컴파일/역할 검사. **Firebase 테스트 프로젝트**의 ID를 다시 확인한 뒤 **Realtime Database → Rules → Publish**. 현재 관리 연결이 없으므로 Console 게시가 필요합니다. 운영 프로젝트에는 붙여넣지 않습니다.
3. 이미 적용된 SQL은 재실행하지 않습니다. 테스트 Supabase → **Storage**의 Private 상태 및 **Database/SQL Editor**의 기존 RLS/권한을 읽기 확인합니다. **Edge Functions → Secrets**에 생성된 `server-secrets.env`의 5개 앱 설정만 넣습니다. Supabase 기본 서버 키는 서버에서만 사용합니다.
4. 신뢰할 수 있는 로컬 담당자 환경에서 기존 Supabase CLI의 **관리 로그인** 후, 저장소의 `veteransgeo/` 디렉터리에서 `supabase functions deploy media --project-ref <확인한-테스트-ref>` 실행. index.ts 한 파일만 Dashboard에 붙여넣으면 상대 경로 서버 모듈이 빠집니다. 전체 기존 소스를 사용해야 합니다. Firebase JWT 검증을 제거하지 않으며 이 경우에만 기존 `verify_jwt=false`를 유지합니다. 관리 토큰을 config나 채팅으로 전달하지 않습니다.
5. 필요한 대상 호스트의 네트워크 설정 적용 후 `live:probe` → 대상/키 프로젝트 일치 시에만 `live:protocol` → `live:serve`와 세 독립 브라우저 세션. 기존 아래 명령/수행 범위를 그대로 사용합니다. 이번 작업에서 실제 서버 단계는 모두 미실행입니다.

운영 전체 Rules·실제 계정 승인 목록이 없으므로 운영 permission_denied 원인은 여전히 미확정입니다. 구형 awarenessOriginal 누락 거부는 후보 테스트의 재현 조건이며 운영 원인 확정이 아닙니다. 테스트 DB가 현재 잠금 Rules라는 사용자 확인은 별도로 기록합니다.

## GitHub Pages 정적 준비 검사

오래된 로컬 `_site`는 최신 manifest와 달라 최초 검증에 실패했습니다. `/tmp/veteransgeo7-old-artifact-*`에 보존한 후 `node scripts/build-public-site.mjs`로 다시 만들고 `node scripts/verify-public-site.mjs` **99개 통과**, `node veteransgeo/security/build-netlify.mjs` **18개 통과**했습니다. 운영 배포를 실행한 명령이 아닙니다.

`npm run test:pages`를 추가해 실제 `_site`를 **`/school-web-projects26/` 하위 경로**로 제공하고 다음을 검사했습니다: 18개 앱 파일 HTTP 200·원본 바이트 동일, HTML/JS/CSS/JSON 상대 참조 manifest 포함, 세 페이지/학생 3단계·7학교·빈 공식 캐시 대체 검색, 신규 media 모듈·스타일 로딩, 업로드 기본 비활성화, 공개 갤러리 390/820/1440px의 1/2/3열, security/server/SQL/비공개 설정 경로 404. **Firebase SDK/Leaflet은 격리 fixture**, 외부 요청은 실제 서비스로 보내지 않았습니다. CDN/실지도·실제 Firebase·실제 영상 공개 재생을 검증한 것이 아닙니다. 이 검사는 배포 없는 PR CI에만 연결했습니다.

검사한 페이지 SHA256(운영 HTTP와 대조 전):

| 파일 | SHA256 |
|---|---|
| index.html | `65bdfa977868aa67f82c494a7e3df5db8147275a45fca08898d52cb75a7eee41` |
| teacher.html | `dcec76e89f12755948c4aa02f87ac49f29bc09ae6c810912e9be37d7686cd941` |
| public.html | `4bd056f730733e8f47b4792f0e872c82ac18b475b239b9a0f3e1fb9da2a3ed7e` |

`deploy-version.json`의 과거 날짜/branch/source_blobs는 최신 세 페이지의 배포 증거가 아닙니다. 배포 후에는 Actions의 실제 배포 SHA와 기존 URL HTTP 바이트 해시를 함께 비교해야 합니다. 현재 운영 URL은 CONNECT 단계 차단으로 버전을 확인하지 못했습니다. `pages.yml`은 main push 외에 수동 실행도 허용하며 workflow 자체에는 main ref 제한 조건이 없습니다. GitHub 환경의 branch 보호 여부는 미확인입니다. **Run workflow/Ready for review/Merge를 누르지 않으며**, 운영 전환 승인 전에 수동 main 제한·environment 보호를 검토합니다. Pages workflow/기존 Netlify 설정은 이번에 변경하지 않았습니다.

**판정:** GitHub Pages 정적 코드 검사 통과 / 테스트 Firebase·Supabase 실연동 미실행 / 운영 적용 준비 미완료 / 운영 배포 미실행 / 신규 기능 실제 수업 적용 보류. 공식 시설 캐시는 빈 상태, 실제 학생 파일의 Mumbai 저장은 학교의 외부 서비스·국외 보관 승인 전 금지입니다. 실제 Dashboard 사용량/Free 상태도 사용자 확인과 별도 실측을 구분합니다.

Notion 미반영: 연결 도구 없음. 복사 문안: “PR #7 7차: 실제 테스트 프로젝트 생성·SQL/RLS 적용은 사용자 확인. private config와 안전 입력 도우미 준비, 미확인 값은 null. 최신 Supabase 서버 키 형식 지원, 무인증/Range 검사 보강, Pages 99개·하위 경로/브라우저 검사 통과. 네트워크 CONNECT 403 및 비공개 값/관리 연결 대기로 실제 Firebase·Supabase 업로드/승인/피드는 미실행. main·운영 Firebase·배포·결제 변경 없음.” 최종 SHA/KST와 CI는 해당 Git 기록을 함께 기재합니다.

---

아래는 6차 당시 기록입니다. 프로젝트 생성 여부의 최신 상태는 위 7차 사용자 확인과 구분합니다.

# 6차: 무료 테스트 프로젝트 연결 — 당시 외부 환경 확인 대기

**실제 Firebase/Supabase 실연동은 아직 증명하지 못했습니다.** 테스트 프로젝트 ID·URL·가상 계정 설정이 제공되지 않았고, 연결된 서비스 도구/승인된 자격증명 바인딩/프로젝트 선택 정보도 없습니다. 환경의 일반 Google 자격증명 변수 존재를 이 앱의 테스트 권한으로 해석하지 않았습니다. main·운영 Firebase·Rules·학생 데이터·production 배포·요금제를 변경하지 않았습니다.

기준: PR #7 Draft, 시작 head `ed1e9e08fb4308c34ed2df4153a0787b1e9ce34a`, main `c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5`. 기존 학생 업로드/교사 검토/공개 피드를 재개발하지 않고 아래 연결 도구를 추가했습니다.

## 지금 추가한 실행 코드

- `live:prepare`: **저장소 밖** 새 `test-web` 복사본만 구성. 원본 Firebase/미디어 설정은 유지합니다. private 테스트 Rules·서버 Secrets 파일도 생성하며, 암호·활동코드·교사 목록은 웹에 복사하지 않습니다. 기존 출력 덮어쓰기·저장소 경로·심볼릭 링크를 거부합니다.
- `rehearsal-target.mjs`, Edge `readiness`: Firebase projectId/DB host/Supabase host를 양쪽에서 고정합니다. 공개 readiness는 이 식별자만 반환하고 DB/Auth/Storage를 호출하지 않습니다. 버킷/RLS/Free 요금제 정상 작동을 보증하는 응답은 아닙니다.
- 생성된 웹 guard: Edge 대상과 Firebase Web API 키의 공개 프로젝트 설정이 일치하는지 **로그인 전** 확인합니다. 운영 프로젝트·다른 서버·다른 Web API 키·잘못된 origin이면 익명 계정 생성/DB 쓰기를 시작하지 않습니다. 생산 설정으로 fallback하지 않습니다.
- `live:probe`: 위 두 공개 GET만 검사하는 읽기 전용 검사. `live:protocol`: 그 검사 뒤에만 가상 계정/실제 파일의 테스트 프로젝트 요청을 시작합니다. raw 토큰/암호/코드는 argv·일반 파일·로그로 보내지 않고 HTTPS 요청용 kernel pipe로 전달합니다. TLS 검증과 기존 프록시를 유지합니다.
- `live:serve`: 생성된 test-web만 localhost에 제공. 상위 폴더의 Secrets/Rules, 개발 파일, 다른 Host 요청은 차단합니다. Netlify preview를 사용하지 않습니다.

`live:protocol`의 준비된 범위: 실제 Auth 익명/승인·미승인 가상 교사, S1~S7 글 메타데이터, 같은 ID 재시도, 타 학생 차단, 사전 인지도 없는 구형 새 생성 거부/신규 형식 성공 대조, 교사 수정·이력·보관·복원, JPEG/WebM 업로드·중복 방지·비공개 미리보기·승인·공개 바이트 일치·승인 해제, 현재 사용량 조회입니다. 파일은 카메라 없이 canvas에서 생성한 유효한 JPEG/WebM입니다.

이 실행기는 **서버 프로토콜 검사**입니다. 실제 브라우저 피드/재생·모바일·취소/네트워크 실패·CSV/지도·직접 Storage RLS·조직별 과금 계측을 모두 완료했다는 보고서를 만들지 않습니다. 결과에 `scope`, `notRun`, `overallClassroomReady:false`를 명시합니다. 요청 상태·송수신 바이트·시간만 기록하고 원문/인증 정보를 남기지 않습니다. 기존 가상 브라우저 검사를 실제 서버 검사로 바꾸어 부르지 않습니다.

## 사용자 확인이 필요한 최소 설정 — 클릭 순서

### 1. Firebase: 별도 Spark 프로젝트

1. Firebase Console 프로젝트 선택기 → **프로젝트 추가/Add project** 또는 이미 만든 **테스트 프로젝트** 선택. 프로젝트 ID가 운영 `school-project-26-1edf4`이면 중단합니다. **사용량 및 결제/Usage and billing**에서 Spark 확인. 결제 등록/Blaze 전환 금지.
2. 톱니바퀴 → **프로젝트 설정/Project settings → 일반/General**: projectId, **프로젝트 번호**, Web 앱 설정(apiKey/authDomain/appId)을 비공개 보관합니다. Web 앱이 없으면 **앱 추가 → Web(</>)**. Hosting은 설정하지 않습니다.
3. **Realtime Database → 데이터베이스 만들기/Create Database**: 잠금 모드 선택. 기본 `{projectId}-default-rtdb` 인스턴스의 정확한 URL 기록. 다른 앱/실제 학생 데이터가 있는 DB는 사용하지 않습니다.
4. **Authentication → 시작하기 → 로그인 방법/Sign-in method**: 익명·이메일/비밀번호 활성화. **Users → Add user**에서 승인용/미승인용 가상 교사 두 명 생성 → 각 UID 확인. 실제 교사·학생 계정을 복제하지 않습니다. Google 방식은 기존 코드에 유지되며 전용 테스트 계정의 후속 실측이 필요합니다.
5. **Authentication → Settings → Authorized domains → Add domain**: 이 테스트 프로젝트에만 `localhost` 추가. 운영 프로젝트/운영 승인 도메인은 바꾸지 않습니다.

### 2. Supabase: 전용 Free 조직·프로젝트

1. Supabase Dashboard → 조직 선택/생성 → **Billing/Subscription**에서 Free 확인 → **New project**. 기존 다른 앱 프로젝트를 재사용하지 않습니다. Free는 조직 전체 할당량을 공유하므로 다른 프로젝트 사용량도 확인합니다. 결제 요구 시 중단하고 무료 계정/한도를 확인합니다.
2. 해당 테스트 프로젝트 → **Project settings → General / Data API 또는 Connect**에서 project-ref와 `https://<ref>.supabase.co` URL 확인. service role은 채팅/클라이언트 설정에 넣지 않습니다.
3. 아래 준비 도구 실행 후 **SQL Editor → New query → Run**에서 저장소의 `supabase/migrations/202610290001_private_media.sql`을 **이 새 테스트 프로젝트에만** 검토 적용합니다. **Storage → veterans-private**의 Private 표시, 15MiB 버킷 제한을 확인합니다. SQL/RLS의 실제 접근 검증은 실행 후 별도로 기록합니다.
4. **Edge Functions → Secrets → Add a secret**에서 준비 도구가 만든 `server-secrets.env`의 다섯 설정을 입력합니다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 Edge 서버의 기본 환경이며 브라우저로 복사하지 않습니다.
5. 담당 개발자가 공식 Supabase CLI로 해당 테스트 project-ref에만 함수 `media`를 배포합니다. 저장소 `veteransgeo/`에서 `supabase functions deploy media --project-ref <확인한-테스트-ref>`를 사용합니다. `config.toml`의 media 함수는 Supabase 자체 JWT 대신 코드의 Firebase RS256 검증을 사용합니다. Firebase 검증을 제거하거나 공개 무인증 업로드로 바꾸지 않습니다. 이번 환경에서는 계정이 없어 이 명령을 실행하지 않았습니다.

### 3. 비공개 입력 파일과 도구 실행

Node 22+, Linux/WSL, curl·mkfifo·OpenSSL·Playwright Chromium이 필요합니다. 공개 [예시 파일](live-config.example.json)을 **먼저 저장소 밖**에 복사하고 파일 권한 0600·폴더 0700을 적용한 뒤 실제 테스트 값만 입력합니다. 예시의 미완성 값은 실행이 거부됩니다.

현재 클라우드에는 `/workspace/private-veteransgeo/live-6/config.template.json`을 0600으로 준비했습니다. 실제 값은 없으며 계정/프로젝트를 생성한 것이 아닙니다. 이 머신을 넘는 백업도 아닙니다. 운영 키/서비스 키를 넣지 말고 가상 계정 비밀번호·학교별 테스트 코드만 비공개 입력에 보관합니다.

저장소 루트에서 실행하는 예시(실제 비공개 경로로 치환):

```sh
# 원본 config 파일은 저장소 밖. prepared는 아직 없는 새 폴더여야 합니다.
npm --prefix veteransgeo/security run live:prepare -- --config /PRIVATE/config.json --out /PRIVATE/prepared-1
```

생성물:
- `prepared-1/test-web/`: 이 복사본의 Firebase·media 설정만 테스트 대상으로 변경.
- `prepared-1/test-only.rules.json`: **테스트 전용 후보**, 실제 운영 Rules 병합본이 아님.
- `prepared-1/server-secrets.env`: 테스트 UID·활동코드 해시·대상/origin. service role·암호·원문 활동코드를 포함하지 않음.
- `prepared-1/targets.json`: 비밀키 없는 대상 확인 기록.

Firebase의 **테스트 프로젝트 → RTDB → Rules → Publish**로 생성한 테스트 후보를 적용합니다. 반드시 프로젝트 ID를 다시 확인합니다. **운영 Rules 원본은 이 별도 테스트를 시작하는 데 필요하지 않습니다.** 실제 운영 이행/원인 확정에는 전체 게시 원문이 별도로 필요합니다.

Supabase Secrets/함수 구성을 마친 뒤:

```sh
# 공개 GET 두 개만 수행. 대상 일치 전에는 Auth 계정을 만들지 않습니다.
npm --prefix veteransgeo/security run live:probe -- --config /PRIVATE/config.json --report /PRIVATE/probe-1.json

# 실제 테스트 서버 요청. 가상 레코드·파일·이력은 테스트 프로젝트에 남깁니다.
npm --prefix veteransgeo/security run live:protocol -- --config /PRIVATE/config.json --report /PRIVATE/protocol-1.json

# 별도 터미널: 웹 복사본만 127.0.0.1에 제공. 상위 prepared 폴더를 웹 루트로 사용하지 마세요.
npm --prefix veteransgeo/security run live:serve -- --prepared /PRIVATE/prepared-1
```

원래 `firebase-config.js`, `media-config.js`, Netlify/Pages 설정은 바꾸지 않습니다. 생성한 config/Rules/Secrets/결과/test-web을 GitHub·Netlify·Pages에 올리지 않습니다. 로컬 서버가 출력한 정확한 localhost 주소를 엽니다. 미리보기 401을 풀거나 운영 Firebase를 대신 사용하지 않습니다.

이 클라우드의 현재 outbound 정책은 제한 상태이며 테스트 호스트 허용이 확인되지 않았습니다. 실제 ID가 정해지면 **해당 DB 호스트, 해당 Supabase 호스트, identitytoolkit.googleapis.com, securetoken.googleapis.com, www.gstatic.com** 등 필요한 호스트만 환경 설정 검토로 허용해야 합니다. 지도/Leaflet은 기존 사용 CDN·타일 호스트도 필요합니다. 프록시/TLS/인증을 우회하지 않습니다.

### 4. 실제 UI 확인과 증거

서버 프로토콜 통과 후, 학생·교사·공개는 **서로 다른 브라우저 프로필/시크릿 세션**을 사용합니다. 같은 origin의 탭은 Firebase 로그인 상태를 공유하므로 학생 탭을 교사 로그인으로 바꾸지 않습니다.

1. 학생 `/`: 글 제출 → JPEG/WebM 선택·미리보기·진행률 → 실패/취소 후 동일 작품 재시도 → ‘선생님 검토 대기’와 상태 확인.
2. 교사 `/teacher.html`: 가상 승인 계정 로그인 → 검색·비공개 미리보기·수정/이력·승인. 미승인 계정은 별도 세션에서 거부 확인.
3. 공개 `/public.html`: 승인 전 없음 → 승인 후 카드/상세/영상 재생 → 승인 해제 후 목록 제거와 **기존 게이트웨이 주소의 새 GET/Range 거부** 확인. 이미 받은 사본은 회수되지 않습니다.
4. DevTools의 390px/PC 화면, 7학교 필터, 기존 CSV 첫 4열·지도·수동 위치를 확인합니다. 현재 도구는 실제 휴대폰 Safari까지 검증하지 않습니다.
5. 브라우저 Network에서 토큰·암호·코드를 포함한 HAR/원문을 공유하지 않습니다. 역할·기능·HTTP 상태·파일 바이트·시각·화면 통과 여부만 기록합니다.

실제 UI/취소/네트워크/CSV 검사, 직접 Storage RLS, 전체 조직 사용량은 위 자동 프로토콜 결과와 별개입니다. 미실행 항목은 그대로 미실행으로 남깁니다. 테스트 프로젝트의 가상 자료만 교사 보관/정리 도구로 관리하고 전체 DB/다른 루트를 삭제하지 않습니다.

## 무료 한도와 현재 측정

2026-10-29 KST에 공식 Supabase 저장소의 [요금 문서](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/billing-on-supabase.mdx), [파일 제한](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/uploads/file-limits.mdx)을 재확인했습니다. Free 저장 1GB·egress 5GB·함수 500,000회, 글로벌 파일 상한 50MB입니다. 문서는 **조직 전체 합산**이라고 명시합니다. 실제 사용 계정의 Free 상태는 Dashboard 확인 필요입니다.

앱의 3MiB/15MiB/5MiB, 70% 경고/90% 영상 제한/공간 소진 차단은 유지합니다. 프로토콜 실행 후 `usage`의 프로젝트 객체/예약 바이트를 기록합니다. 전송 원장은 **추정치**이며 Supabase **Organization → Usage**의 실제 storage/egress/함수 호출량과 비교해야 합니다. 실제 계정이 없어 현재 클라우드 저장·전송 실측값은 없습니다. 1GB를 채우거나 50만 호출로 한도를 시험하지 않았습니다. 자동 유료 전환은 하지 않습니다.

## 이번에 실행한 것과 미실행

- 로컬 연결 보호/준비 도구 10개 검사: 운영/불일치 차단, 비공개 출력·키 제외, 가상 응답 분류, Chromium의 로그인 전 차단, 유효 JPEG/WebM 생성·디코딩, **TLS 검증을 유지한 localhost 실제 curl 전송**, private 서버 경계, curl 실패 정리. localhost TLS 성공은 Firebase/Supabase 성공이 아닙니다.
- 기존 core/미디어/브라우저·Emulator는 기존 CI를 재사용/회귀 확인합니다. 새 CI도 실제 서비스 자격증명 없이 격리 검사만 수행합니다.
- `live:probe` 필수 설정 없이 실행 시 exit 2로 중단하는 것을 확인했습니다. 알려지지 않은 프로젝트로 요청하거나 운영 설정으로 fallback하지 않았습니다.
- 실제 Firebase/Supabase 프로젝트 생성·Rules/SQL 적용·함수 배포·파일 업로드/승인/공개·사용량 계측: **미실행 — 외부 테스트 환경 확인 필요**.

| 기능 | 1 코드 | 2 Mock/격리 | 3 실제 테스트 프로젝트 | 4 운영 적용 준비 | 5 운영 배포 |
|---|---|---|---|---|---|
| 이미지·영상 업로드/재시도 | 구현 | 통과 | 미실행 | 미완료 | 미배포 |
| 교사 미리보기·승인·해제 | 구현 | 통과 | 미실행 | 미완료 | 미배포 |
| 공개 피드·접근 차단 | 구현 | 통과 | 미실행 | 미완료 | 미배포 |
| 글·7학교·수정/이력·CSV/지도 | 구현 | 통과 | 미실행 | 미완료 | 미배포 |
| 대상 검증·비공개 준비/HTTP 실행 도구 | 구현 | 로컬 통과 | 미실행 | 테스트 전용 | 운영 대상 아님 |
| 공식 시설 실데이터 | 캐시 도구만 구현 | 가상 자료만 | 미확보 | 미완료 | 미배포 |

## 공식 자료·운영 오류·학교 승인

공식 API/안내를 재요청했으나 이 환경의 **CONNECT 403**으로 원서버에 도달하지 못했습니다. HTTP 원서버 상태·CORS·좌표계/축·이용 조건을 검증한 것이 아닙니다. 캐시는 빈 상태로 유지했습니다. 공식 안내의 JSON/CSV 다운로드, 공공데이터포털 **데이터 찾기 → ‘국가보훈부 현충시설’ 검색 → 제공기관/이용허락/좌표 명세 확인 → 공식 파일 다운로드**, 담당 부서 제공 파일을 확보한 뒤 기존 [반입 도구](FACILITY-IMPORT.md)로 검토합니다. 확인하지 못한 다운로드 파일 ID나 시설/좌표를 만들지 않습니다.

운영 permission_denied 원인은 전체 게시 Rules/Auth가 없어 미확정입니다. 별도 테스트 strict 후보에서 구형 awarenessOriginal 누락과 신규 정상 입력을 대조하는 결과만 테스트 원인으로 기록합니다. 운영 원인 해결/실제 병합 완료로 바꾸지 않습니다.

현재는 가상 자료만 사용합니다. 실제 학생 이용 전 학교의 외부 서비스 사용 승인, 개인정보/국외 보관·삭제 정책, 얼굴·위치정보·저작권 검토와 학생 안내를 확인해야 합니다. 이 검토가 끝났다고 주장하지 않습니다.

Notion 미반영(외부 쓰기 미실시). 복사 문안: “PR #7 6차 무료 실연동 준비 / 현재 테스트 프로젝트·계정 연결 미확인 / 운영 연결 전 차단·private test-web·실제 HTTP 프로토콜 실행기 구현 / 로컬 TLS·브라우저 보호 검증 / 실제 Firebase·Supabase 업로드/승인/피드 검증 미실행 / main·운영 Firebase·배포·요금제 변경 없음”. SHA/KST는 최종 Git 기록을 함께 기재합니다.
