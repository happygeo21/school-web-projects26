# 무료 미디어 구현 결과 — 실제 서비스 연결 전

2026-10-29 KST. 기존 PR #7 / `codex/veteransgeo-upgrade`에서 구현했습니다. **로컬 가상 저장소에서 학생 제출 → 교사 검토 → 공개 피드 → 승인 해제 흐름을 실행했습니다. 실제 Firebase 테스트 프로젝트·Supabase 계정 연결은 미완료, 운영 미배포입니다.** main·운영 Rules·학생 데이터·기존 Firebase 설정·다른 앱·요금제는 변경하지 않았습니다.

## 실제 런타임 변경

- `index.html`, `media.js`: 상단 독립 제출 버튼, 같은 페이지 폼, 글/사진/포스터/카드뉴스/영상/PDF/링크 유형, 학교 재사용, 이미지·영상/PDF 미리보기, 이미지 1440px JPEG 재인코딩, SHA256·고정 작품 ID, 전송률/취소/재시도, 내 제출 상태. 파일 자체는 sessionStorage에 넣지 않으며 새로고침 후 같은 파일 재선택이 필요합니다. 최초 전송 후 다른 내용을 조용히 덮어쓰지 않습니다.
- `teacher.html`, `media.js`: 검색·상태별 대기함, 비공개 미리보기, 승인/수정 요청/반려/승인 해제/보관/복원, 제목·소개 수정, 학생 원본/수정 이력, 사용량·고아 파일 점검. 보관 복원은 승인 대기로 돌아가 재검토합니다.
- `public.html`, `media-gallery.js`, `media.css`: PC 3열/태블릿 2열/모바일 1열 피드, 글 타이포 카드, 이미지 지연 로드, 영상 클릭 재생(자동재생 없음), 최신순·6개씩 더 보기, 학교/시설/유형 필터, 상세·출처·지도 연계. 기존 지도·통계·CSV는 유지합니다. 이미지 한 개를 압축해 저장하며 별도 유료 이미지 변환 API는 쓰지 않습니다. 독립 썸네일 생성/보관은 구현하지 않았습니다.
- `media-provider.js`, `media-policy.js`, `media-config.js`: Firebase Storage SDK 의존 제거, 외부 게이트웨이 Provider와 공통 검증·용량 정책. `MEDIA_UPLOAD_ENABLED=false`는 그대로이고 외부 Provider도 기본 `enabled:false`입니다. 계정 없이 실행하는 Mock은 `security/` 아래에만 있습니다.
- `official-facilities.js`: 검색어 정규화, 학교 지역 우선, 검색 결과/출처 안내, 선택 시설의 작품 폼 반영. 실제 공식 캐시는 여전히 비어 있으며 가짜 시설은 추가하지 않았습니다.

## 서버·저장소 구조

`supabase/functions/media/index.ts` → `server/firebase-token.mjs` / `gateway.mjs` / `supabase-adapter.mjs`와 전용 비공개 버킷·SQL 예약 원장을 구현했습니다. 서비스 키는 서버에서만 사용합니다. Web 클라이언트에는 Supabase service role/업로드 서명 URL/원본 객체 경로를 주지 않습니다. 현재 Edge 진입점은 **운영 Firebase ID/호스트를 명시적으로 거부**합니다. 테스트 전용입니다.

Firebase RTDB가 작품 메타데이터·검토 상태·공개 사본의 기준입니다. 학생은 먼저 자신의 `works/{school}/{uid}/{workId}`에 pending 메타데이터를 저장하고, 게이트웨이가 그 레코드와 Firebase ID Token을 확인한 뒤 파일을 저장합니다. 교사의 검토 상태·이력·공개 사본은 기존 RTDB atomic update로 함께 바뀝니다. 파일과 RTDB 사이에 분산 트랜잭션이 있다고 주장하지 않습니다.

Firebase Third-party Auth 직접 연결은 공식 문서에서 `role: authenticated` custom claim을 요구합니다. 기존 익명/교사 계정의 claim을 바꾸지 않기 위해 별도 검증 게이트웨이를 사용합니다. Firebase 프로젝트를 고정하고 Google JWK로 RS256 서명, kid/alg, exp/iat/auth_time, aud/iss/sub를 검사합니다. 키/토큰/이메일을 로그에 출력하지 않습니다. 토큰 철회·사용자 disable의 즉시 감지는 구현하지 않았으므로 정상 토큰 만료 전의 잔여 접근 가능성은 남습니다.

학교는 S1~S7 및 서버에 등록한 활동코드 해시로 확인합니다. 이 검사는 학교 재학 증명은 아닙니다. 활동코드는 교사가 전달하고 비공개로 관리해야 합니다. 교사는 서버의 기존 승인 UID 목록 + 실제 Firebase Rules 읽기 권한이 필요합니다. 로그인만으로 승인을 부여하지 않습니다. 운영 7교사 계정을 변경하거나 명단을 커밋하지 않았습니다.

### 파일/접근 정책

- 이미지 최대 3MiB, 영상 15MiB, PDF 5MiB, 작품당 한 파일. 브라우저/서버/SQL에서 검증하고 버킷 상한은 15MiB입니다. 영상 60초는 권장 길이이며 서버가 재생 시간을 강제하지 않습니다.
- 서버는 최대 허용량까지만 body를 읽고 실제 바이트 수·SHA256·선언 MIME·파일 시그니처를 대조합니다. 동시에 파일을 읽는 요청은 worker당 2개로 제한합니다. 이미지 압축은 브라우저에서 수행합니다.
- Free에서 서명 업로드 토큰이 파일별 형식/바이트/재사용 횟수를 모두 강제한다고 확인하지 못했으므로 직접 서명 업로드를 열지 않았습니다. 최대 15MiB의 제한된 중계 업로드를 택했습니다. 대용량/재개 업로드는 미구현이며 외부 링크를 안내합니다. 실제 Free worker의 메모리/CPU/150초 제한과 학교 네트워크 속도는 테스트 프로젝트에서 측정해야 합니다.
- 버킷은 비공개, 테이블 RLS 활성화, anon/authenticated 테이블·RPC 접근 거부, 서버만 service role을 사용합니다. 기존 공개 버킷이면 migration은 중단합니다. 전용 새 Supabase 프로젝트를 사용해 기존 Storage 정책과 섞이지 않게 합니다. 실제 Supabase RLS·Storage REST 결과는 아직 실측하지 않았습니다.
- 공개 미디어는 opaque 공개 ID를 가진 게이트웨이 주소만 사용합니다. 요청마다 현재 `publishedWorks` 승인 여부를 다시 확인하고 `Cache-Control: no-store`로 반환합니다. Range 요청도 승인 검사를 거칩니다. 서명 URL 만료 지연은 사용하지 않는 구조입니다.
- Mock에서는 승인 해제 후 **다음 요청 403**, 열린 상세/미디어 제거를 확인했습니다. 실제 RTDB 전파·프록시 지연·이미 시작된 응답은 별도 실측이 필요합니다. 이미 내려받은 바이트/스크린샷/외부 링크 사본은 회수할 수 없습니다.
- 이미지 재인코딩은 원본 EXIF/GPS를 복사하지 않습니다. 얼굴/보이는 개인정보, 영상·PDF 속성, 악성파일/저작권은 자동 해결되지 않습니다. 시그니처 검사는 바이러스 검사·완전한 컨테이너 검증이 아닙니다. 교사 검토가 필수입니다.

### 실패와 복구

| 실패 | 구현한 동작 |
|---|---|
| RTDB 메타데이터 저장 실패/ACK 불명 | 파일 업로드를 시작하지 않음. 최초 payload/ID로 RTDB 재시도 |
| 메타데이터 저장 후 파일 실패/취소 | pending 유지·공개 없음·입력/선택 파일 유지. 같은 ID/체크섬으로 재시도 |
| 파일 성공 후 응답 유실 | 동일 원장의 ready 객체를 재사용. 중복 객체를 만들지 않음 |
| 파일 저장/원장 확정 실패 | 삭제 확인 후에만 예약 해제. 삭제 불명은 예약을 남겨 공간을 과소계상하지 않음 |
| 고아 파일/원장 uploading 정체 | 승인 교사 점검이 50개씩 검사. 10분 이후 HEAD/메타데이터 대조, 복구 또는 정리 |
| 원본 메타데이터 없음 | 24시간 경과·공개 사본 없음 확인 후 파일만 삭제 |
| 보관/반려 | 30일 경과·공개 사본 없음 확인 후 파일 정리. RTDB 학생 원본/이력은 삭제하지 않음 |
| DB 접속 실패 | ‘없음’으로 간주하지 않고 정리 중단 |
| 승인/공개 사본 변경 실패 | 하나의 RTDB update가 거부되어 양쪽 변경 실패. 파일은 비공개 그대로 |

정리는 교사가 누르는 도구이며 자동 cron은 설치하지 않았습니다. 장기 보관 기간은 교사가 확정해야 합니다. 복구를 위해 삭제된 파일을 자동 되살리지는 않습니다. free 프로젝트 일시 중지 시 글/링크·오프라인 활동으로 대체하고 소유자가 Dashboard에서 Resume/Restore 가능 여부를 확인합니다. 계정에서 실제 제공하는 백업 정책을 확인하고, 허용된 비공개 보관소에 별도 백업한 뒤 복구해야 합니다. 유료 백업 가입은 하지 않습니다.

## 무료 한도: 공식 문서 확인과 추정 분리

2026-10-29 KST에 Supabase 공식 저장소의 문서를 읽었습니다. supabase.com 직접 요청은 이 머신의 CONNECT 403으로 차단되어, 공식 `supabase/supabase` 저장소에 게시된 문서를 대안으로 확인했습니다.

- [공식 요금·할당량 문서](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/billing-on-supabase.mdx): Free 저장 1GB, egress 5GB, 함수 호출 500,000회. Free 프로젝트 한도/중지 가능성과 실제 조직 플랜은 Dashboard에서 재확인해야 합니다. 중지 기간을 추정해 확정하지 않습니다.
- [파일 제한](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/uploads/file-limits.mdx): Free 글로벌 최대 50MB, 버킷별 더 작은 제한 가능.
- [비공개 버킷](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/buckets/fundamentals.mdx), [Firebase claim 요구](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/third-party/firebase-auth.mdx).
- [Edge 제한](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/limits.mdx): 메모리 256MB, Free wall clock 150초, CPU 2초. 실제 성능 통과를 의미하지 않습니다.

SQL은 실제 `storage.objects.metadata.size` 합계와 미완료 예약을 보수적으로 합산합니다. 70% 경고, 90%에 도달할 새 영상 거부, 1,000,000,000 bytes 초과 거부입니다. SQL 잠금으로 7학교의 동시 예약을 직렬화하고 UID당 하루 3작품·프로젝트 하루 300작품을 기본 제한합니다. 익명 UID 재생성으로 개인 제한을 피할 수 있어 학교 활동코드/전체 공간·일일 상한도 함께 둡니다. 무차별 함수 호출 자체의 DoS/플랫폼 사용량 소진을 완전히 막는 기능은 아닙니다.

게이트웨이 전송 예약은 월 4GB/40만 다운로드에서 차단합니다. Range도 전체 파일 크기를 예약하므로 **보수적인 앱 추정치**이지 실제 청구 egress/전체 함수 invocation 계측이 아닙니다. 실패·preflight·인증 실패도 플랫폼 호출량을 쓸 수 있습니다. 실제 사용량은 Supabase Dashboard의 **Organization → Usage**와 비교해야 합니다. 자동 유료 결제/전환은 구현하지 않습니다.

다음은 한 명당 한 작품, 저장 한도 1GB를 기준으로 계산한 **예상치**입니다. 압축 결과/실제 업로드 수는 아직 계측하지 않았습니다.

| 시나리오 | 100명 | 200명 | 300명 |
|---|---:|---:|---:|
| 이미지 평균 1MiB | 105MB(10.5%) | 210MB(21.0%) | 315MB(31.5%) |
| 이미지 최대 3MiB | 315MB(31.5%) | 629MB(62.9%) | 944MB(94.4%) |
| 80% 1MiB 이미지 + 20% 10MiB 영상 | 294MB(29.4%) | 587MB(58.7%) | 881MB(88.1%) |
| 모두 15MiB 영상 | 1.57GB, 제한 발생 | 3.15GB, 제한 발생 | 4.72GB, 제한 발생 |

최대 크기 영상만 올리면 약 57개 이후 90% 경계에서 새 영상이 거부됩니다. 공개 열람 전송량도 따로 필요하므로 무료로 무제한 영상 전시를 보장하지 않습니다. 큰 파일/소진 시 외부 링크·압축·글을 사용합니다. 대량 동시 접속의 실제 처리량은 별도 테스트가 남아 있습니다.

## 실행과 검증 상태

### 계정 없는 로컬 실습

```sh
cd veteransgeo/security
npm ci
npm run mock:media
# 출력된 localhost 주소의 /, /teacher.html, /public.html 사용. 활동코드 TEST.
```

Mock 서버는 127.0.0.1에만 열립니다. Firebase SDK를 가상 구현으로 바꾸고 메모리 저장소를 사용하며 화면에 Mock 표시를 합니다. 서버를 끄면 가상 기록이 사라집니다. 운영 SDK/DB 접속 없이 흐름을 실행하는 **개발 전용 도구**입니다. 이 서버나 security/를 Netlify/Pages로 게시하지 않습니다.

```sh
npm run test:core
VETERANSGEO_BROWSER=/usr/bin/chromium npm run test:browser
VETERANSGEO_BROWSER=/usr/bin/chromium npm run test:media
# demo-veteransgeo Emulator만 사용. 실제 프로젝트 ID로 교체 금지.
npm test
```

| 테스트 층 | 실제 실행/결과 | 의미 |
|---|---|---|
| 로컬 core | 9개 통과 | 기존 좌표/오류/보안 도구와 새 용량 경계 |
| 기존 가상 브라우저 | 1개 통합 통과 | 7학교·permission_denied/새로고침·동일 ID·교사 수정/이력·CSV·지도·공식 캐시 가상 자료·모바일 회귀 |
| 새 로컬 미디어 | 6개 통과 | 진짜 Chromium 이미지 재인코딩·WebM 파일 선택/업로드·취소·승인·공개 피드, Mock gateway 소유권/승인해제·불일치 복구·한도, 실제 RSA JWT 검증, Postgres WASM SQL/RLS/예약 검사 |
| Deno check | Edge 진입점 타입 검사 통과 | 실제 Edge 배포/권한/속도 통과와 다름 |
| 로컬 Firebase Emulator | 다운로드 403으로 실행 불가 | 차단을 우회하지 않음. 기존 배포 없는 CI에서 실행 결과를 별도로 확인 |
| 실제 테스트 Firebase/Supabase | **미실행** | 계정/프로젝트/승인 설정 미제공 |
| 실제 운영 Firebase | **미실행** | 운영 테스트 금지 유지. permission_denied 원인 미확정 |

요청한 추가 20항목 중 텍스트/이미지/영상, 형식/용량, 인증/소유권, 승인 전 비공개/승인/피드/해제, 재시도/정리, 7학교·권한 오류·교사 수정·공식 검색 UI·반응형·CSV·한도는 위 가상 테스트로 다룹니다. **공식 실데이터, 실제 Supabase API/RLS/Range/성능, 실제 Firebase 인증/Rules 4조합·교사 계정 수업 리허설은 미완료**입니다. Mock 파일 업로드 성공을 실제 Supabase 업로드 성공으로 표현하지 않습니다.

기존 awarenessOriginal 필수 조건은 약화하지 않았습니다. 구형 새 제출이 strict 후보에서 거부되는 테스트와 미디어 원본/해시 변경 거부·신규 상태 테스트를 Emulator suite에 추가했습니다. 운영 전체 Rules 원본은 여전히 미제공이며 실제 병합본 검증을 완료로 표시하지 않습니다.

새 공개 빌드: Pages 99개 / 해당 Netlify 18개 allowlist. 서버·SQL·Supabase·security/를 산출물에서 제외했습니다. 실제 Netlify preview의 401 보호 뒤 artifact/백엔드는 여전히 사용자 확인 필요입니다. 두 preview를 운영 연결 가능 상태로 취급하며 쓰기 테스트를 하지 않았습니다.

## 교사에게 필요한 외부 설정 — 최소 항목

1. **Firebase 별도 Spark 테스트 프로젝트**: 기존 [테스트 연결 절차](OPERATIONS-INPUT-CHECKLIST.md#3-테스트-firebase-연결--운영-설정-파일을-건드리지-않는-절차)를 따라 projectId/정확한 DB URL·익명/Google/이메일 제공자·테스트 교사 UID를 준비합니다. 실제 운영 Rules 전체 원본은 비공개로만 백업해야 합니다.
2. **Supabase Free 전용 테스트 프로젝트**: Free 조직인지 확인 → New project. 결제 등록 없이 project URL/ref만 확인합니다. 다른 앱/기존 저장소 프로젝트를 재사용하지 않습니다.
3. 서버 담당자는 이 PR의 SQL을 **그 테스트 프로젝트에만** 검토 적용하고 Edge Function `media`를 구성합니다. 필요한 Secrets는 `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `APPROVED_TEACHER_UIDS`(JSON 배열), `SCHOOL_ACTIVITY_HASHES`(S1~S7 코드 SHA256 JSON), `ALLOWED_ORIGINS`(JSON 배열)입니다. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 기본 환경입니다. 키/UID/코드를 PR·브라우저에 넣지 않습니다. 코드 해시는 Node/Web Crypto SHA256으로 비공개 생성합니다.
4. 서버 측 JWT 검증이 있으므로 이 함수만 `verify_jwt=false` 설정을 사용합니다. Supabase JWT 게이트를 끄는 대신 Firebase 토큰 검증을 반드시 유지합니다. 공개 무인증 업로드가 아닙니다. 실제 함수 설정/Secret 누락 시 연결을 중단합니다. Storage private·서비스 역할만 접근 가능함을 별도로 시험합니다.
5. 저장소 밖 테스트 웹 복사본의 **테스트용** `firebase-config.js`와 **그 복사본의** `media-config.js`에만 `{enabled:true, endpoint:'https://<ref>.supabase.co/functions/v1/media'}`를 넣습니다. 브라우저용 Supabase service key는 필요 없습니다. tracked 운영 Firebase 설정은 수정하지 않습니다. 기존 Netlify 환경변수만 넣고 분리됐다고 판단하지 않습니다.
6. 테스트 7학교·승인/미승인·새 URL/Range의 승인 해제·중복/한도·원본 보존·actual Dashboard Usage를 확인합니다. 그 뒤 별도 운영 전환 검토를 받습니다. 현재 구현은 운영 Firebase 연결을 거부하므로 실운영에는 후속 승인된 설정 검토도 필요합니다.

파일 직접 업로드의 상태: **코드 구현 완료 / 가상 테스트 통과 / 실제 테스트 프로젝트 미완료 / 운영 미배포**. 기존 글·외부 링크는 개발 구현을 유지하며 신규 운영 Rules 적용 전 운영 사용 완료로 표시하지 않습니다. 신규 기능의 실제 수업 적용은 **보류**, 가상 실습과 수동 기록 활동은 가능합니다.

추가 개발로 운영 자료 부족을 감추지 않습니다. 필수 미확보 자료는 실제 Rules 전체 원문, 별도 Firebase/Supabase 프로젝트·가상 승인 계정/활동코드, Netlify artifact/보호 설정, 공식 원자료/좌표 명세/이용 조건입니다.

Notion 미반영: 외부 쓰기를 하지 않았습니다. 복사 문안: “PR #7 무료 미디어 Provider·비공개 게이트웨이·학생 업로드·교사 검토·공개 피드 구현 / 가상 브라우저·JWT·SQL·게이트웨이 검증 / 실제 테스트 Firebase/Supabase·공식 자료 미확보 / 운영 적용 보류 / main·운영 Firebase·배포·요금제 변경 없음”. 커밋 SHA/KST와 최종 CI는 최종 보고/PR 기록을 함께 확인합니다.
