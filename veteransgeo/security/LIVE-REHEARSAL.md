# 6차: 무료 테스트 프로젝트 연결 — 현재 외부 환경 확인 대기

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
