# PR #7 초대 링크 권한 및 테스트 적용 안내

기준 HEAD: `d06b5e9f1c97d5624de681f6a2ce91fe3377a3dc`. 기존 학생 3단계·3페이지·activityCode·7개 교사 계정/로그인 방식은 변경하지 않았다. 이 변경은 Draft 검토용이며 원격 SQL 적용/Edge 배포를 실행하지 않는다. 기존 63건 기록은 재사용하고 변경과 관련된 검사만 로컬 재실행한다.

## 교사별 권한

| 주체 | 발급/조회 | 폐기 |
|---|---|---|
| 일반 승인 교사 | 서버 설정의 담당 학교만, 목록은 본인 발급분만 | 담당 학교의 본인 발급 링크만 |
| 명시적 전체 관리자 | 승인 교사 목록과 별도 관리자 목록에 모두 등록된 계정만 전체 학교 관리 | 다른 발급자의 링크도 가능 |
| 학교 미지정/미승인/학생 | 거절 | 거절 |

프런트의 학교 선택/teacher/admin/actor 필드는 권한 근거가 아니다. gateway가 검증한 Firebase JWT의 UID로 서버 전용 정책을 조회하고, RPC에 별도 `actor` 문맥을 만든다. SQL도 요청자 UID와 actor UID, 학교, 발급자를 다시 검사한다. `actor`를 클라이언트 JSON에서 전달하지 않는다.

SQL RPC는 `veterans_upload_access(text,jsonb,jsonb)`이며 `public/anon/authenticated` EXECUTE를 거절하고 `service_role`에만 허용한다. Firebase UID는 Supabase `auth.uid()`가 아니므로 JWT 검증을 수행하는 Edge가 신원 확인의 경계다. service_role은 신뢰된 서버 전용이며 공개 코드/설정/응답에 전달하지 않는다. `SECURITY DEFINER`는 빈 search_path와 스키마를 명시한 객체 참조를 유지한다. 이전 2인자 RPC가 남아 있으면 migration 자체를 중단한다.

## 비공개 서버 설정

실제 값은 기존 관리 연결의 비공개 설정에서만 다룬다. 이 문서/채팅/GitHub에 교사 UID·키·비밀번호를 기록하지 않는다. 기존 7개 UID는 교체하지 않는다.

- `APPROVED_TEACHER_UIDS`: 기존 승인 계정 목록 유지.
- `INVITE_TEACHER_SCHOOLS`: 기존 UID를 키, 담당 학교 코드 배열을 값으로 하는 JSON 객체. 누락 계정은 초대 관리 거절, 누락/잘못된 설정은 전체 학교 권한으로 대체하지 않는다.
- `INVITE_ADMIN_UIDS`: 기본 `[]`. 운영자가 명시적으로 승인한 계정만 비공개로 등록하며, 기존 승인 목록에도 있어야 한다. 일반 교사를 자동 관리자로 취급하지 않는다.
- `UPLOAD_AUTH_MODE=teacher-invite-link`: 테스트 서버 초대 모드. `ALLOWED_ORIGINS`는 실제 승인한 테스트 호스트만.
- Supabase 서버 키는 기존 런타임 선택 규약(`SUPABASE_SECRET_KEYS`의 default 또는 기존 service role)을 유지. 새 키를 채팅/GitHub로 수집하지 않는다.

잘못된 JSON/정책 오류는 입력 원문 없이 고정 문구로 실패한다. 정책은 서버에서 복사해 사용하므로 외부 객체 변경으로 권한을 바꾸지 않는다. 권한 설정 변경은 테스트 함수 런타임에 반영됐는지 확인해야 한다.

## 테스트 DB 적용 파일과 사전 검사

대상은 기존 테스트 Supabase `jfkjuhxkcctfmwojhpci`와 Firebase `veteransgeo-test-2026`뿐이다. 테스트 Edge도 두 식별자를 정확히 검사한다. 운영 서울 Supabase/운영 Firebase는 대상이 아니다.

1. 기존 ChatGPT Supabase 관리 연결에서 테스트 project-ref를 선택하고 [upload-invites-preflight.sql](upload-invites-preflight.sql)을 읽기 전용 실행한다. 기존 테이블/함수/부분 적용 흔적, baseline 스키마와 private bucket을 확인하고 media 수를 기록한다. SQL만으로 연결 project-ref를 확인할 수는 없으므로 관리 연결의 프로젝트 확인이 먼저다.
2. 사용자 확인 상태는 기존 미디어 9건/비공개 버킷 유지, 신규 3테이블/RPC 없음이다. Codex는 원격 DB를 조회하지 않았으므로 실제 사전 검사 결과와 migration history를 관리 연결에서 확인한다. 객체가 하나라도 있거나 baseline이 다르면 중단한다. 삭제/재생성/IF NOT EXISTS로 충돌을 덮지 않는다.
3. 최초 적용 파일은 [202610300001_upload_invites.sql](../supabase/migrations/202610300001_upload_invites.sql) **하나**다. 새 테이블 3개와 3인자 RPC 하나, 새 객체의 RLS/권한만 생성한다. 기존 `202610290001_private_media.sql`을 재실행하지 않는다. 기존 media/bucket/파일/기존 함수는 변경하지 않는다.
4. SQL 파일은 BEGIN/COMMIT을 포함하고 충돌 시 실패한다. 관리 도구가 별도 트랜잭션을 감싼다면 해당 도구의 실행 방식에 맞춰 단일 트랜잭션을 보장한다. 실패 시 rollback하고 원인을 확인한다. 부분 적용을 지우고 재시도하지 않는다.
5. 적용 후 3개 테이블 RLS, 3인자 RPC의 빈 search_path, `anon/authenticated` EXECUTE=false 및 service_role=true, 이전 2인자 RPC 부재, 기존 media 9건과 비공개 버킷/객체 보존을 읽어 확인한다. 원문 데이터/UID/토큰은 공개 보고서로 내보내지 않는다.

## 테스트 Edge Function 배포 파일

[invite-deploy-manifest.json](invite-deploy-manifest.json)의 경로별 SHA256을 사용한다. 함수 이름은 기존 `media`이고 운영 entry는 배포 대상이 아니다.

- `supabase/functions/media/index.ts`
- `server/gateway.mjs`, `server/upload-access.mjs`, **`server/invite-policy.mjs`**
- `server/firebase-token.mjs`, `server/supabase-adapter.mjs`, `server/supabase-key.mjs`, `server/rehearsal-target.mjs`
- `media-policy.js`
- 배포 설정: `supabase/config.toml`의 기존 Firebase JWT 검증 경로(`verify_jwt=false`, gateway가 Firebase 토큰 검증)를 유지.

위 경로는 `veteransgeo/` 기준이다. 배포 시 import 상대경로를 보존한다. 테스트 서버 설정과 SQL RPC 인자를 함께 바꿔야 한다. 이전 서버/클라이언트와 불일치하면 거절하며 구 인증코드로 자동 대체하지 않는다.

실제 관리 API에서 배포된 함수 소스/버전과 manifest 파일 해시를 비교하고 모드/정책 반영을 검사한다. readiness의 `apiVersion:1`만으로 새 배포 완료를 주장하지 않는다. 테스트 클라이언트의 생성된 `media-config.js`만 `uploadAuthorization: "teacher-invite-link"`와 테스트 endpoint로 맞춘다. 저장소의 기본 disabled 설정과 학생 HTML은 수정하지 않았다. 기존 준비/Preview 생성기의 기본값을 그대로 사용하면 구 방식이므로 생성 결과를 반드시 확인한다.

## HTTPS 401 진단과 토큰 보호

학생·교사·공개 Netlify 주소 모두 HTTP 401이며 Netlify Login Redirect HTML이다. HTTP Location 헤더 리다이렉트가 아니라 JavaScript가 `app.netlify.com/edge-access`로 이동한다. 앱/Firebase 로그인 전에 차단된 호스팅 접근 제한이다. 해당 코드가 fragment를 requested_path 쿼리로 옮기므로 **현재 호스트에 초대 링크를 공유하지 않는다**. 실제 토큰을 보내거나 인증 설정을 해제하지 않았다.

기존 임시 Cloudflare 주소는 HTTP 403 `Your request was blocked.`이다. 현재 사용할 수 없지만 종료/연결 프로세스 상태는 이 응답만으로 확인할 수 없다. proxy 차단 또는 터널 종료로 임의 확정하지 않는다. 새 터널로 우회하지 않았다.

테스트 media readiness는 200으로 정확한 테스트 Firebase/Supabase를 표시한다. 공개 웹 설정은 401이라 실제 테스트 Auth authorizedDomains/배포된 앱 소스는 미검증이다. 기대 authDomain은 `veteransgeo-test-2026.firebaseapp.com`이며 실제 테스트 HTTPS 호스트가 테스트 Auth 허용 도메인과 media Origin에 함께 등록돼야 한다. 운영 Firebase로 바꾸어 해결하지 않는다.

수업 초대 링크는 공유 가능한 capability다. 전달받은 다른 익명 UID가 새 grant를 받는 것은 가능하다. 반면 이미 발급된 grant를 다른 UID/학교에서 재사용하는 것은 거절한다. 공유 링크를 학생 본인 인증으로 해석하지 않는다. 전체 링크 한도·유효 시간·즉시 폐기를 유지한다. 공개 GitHub, 학생 기록, Web Storage, URL 쿼리, 외부 QR 생성기, 요청/응답 본문·Authorization/X-Upload-Grant 로그에 원문을 남기지 않는다.

## 검증과 다음 단계

`npm run test:media`는 로컬 PostgreSQL WASM + 가상 Firebase/객체 저장소 + 실제 Chromium을 사용한다. 신규 5개 권한 검사와 강화한 브라우저 경로를 포함하며 실제 호스팅 DB/실물 휴대폰 결과와 구분한다. 9건 보존도 **로컬 합성 9건**과 실제 테스트 서버 9건을 구별한다.

실제 서버 검증은 관리 연결에서 사전 검사→SQL→테스트 함수/비공개 정책→리다이렉트가 없는 승인된 HTTPS→가상 자료 실습 순서로 별도 진행한다. 교사는 기존 가상 교사 로그인 방법을 사용한다. 승인 전 비공개, 승인 후 피드 재생, 승인 해제 후 새 GET/Range 차단을 확인한다. 실제 학생 자료는 사용하지 않는다. 운영 배포/병합 승인은 포함되지 않는다.
