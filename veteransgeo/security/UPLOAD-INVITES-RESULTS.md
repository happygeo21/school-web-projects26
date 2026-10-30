# 시간 제한 업로드 링크 검증 기록

검증일: 2026-10-30 KST. 기준: PR #7 Draft, `e500b7e51763dc38fac9119974ef58874a3ac744`. 이 문서는 이번 변경의 로컬 검증 기록이며 호스팅된 테스트 프로젝트나 운영 수업 합격 보고가 아니다. 최신 변경 커밋/실제 CI 링크는 PR #7 작업 보고에 기록한다.

최초 변경 `da08eff724190b24c2082311ef33b7a73b6ab4af`의 [PR CI](https://github.com/happygeo21/school-web-projects26/actions/runs/41039288474)는 Linux/Windows 모두 성공했다. CI에서는 아래 로컬 미검증 항목(Windows TLS/ACL, file:// 화면, demo Rules)도 통과했다. 같은 SHA의 push CI에서는 신규 동시성 테스트가 「1번 작품이 반드시 먼저 승인된다」고 가정해 실패했다. 실제 승인된 작품으로 재시도를 검사하도록 수정했다. 서버 한도/권한 코드는 바꾸지 않았다. 최종 SHA의 CI 결과는 PR 보고를 확인한다.

| 검사 | 결과 | 근거와 한계 |
|---|---|---|
| 기존 업로드 + 새 초대 링크 | 통과 14개 | `npm run test:media`: 이미지 압축/재시도, 영상, 소유권, 공개/철회, JWT, 키 격리, 기존 SQL, 새 SQL/브라우저 |
| 기존 코어 | 통과 15개 | `npm run test:core` |
| 학생 3단계/기존 3페이지 + 운영 보호 | 통과 6개 | `node --test browser.test.cjs production-readiness.test.mjs`: 7학교, 초안 복원, 동일 ID 재시도, 활동코드·기존 파일 보존 |
| 테스트 대상/배포 보호 | 통과 27개 | `rehearsal.test.mjs cutover-smoke.test.mjs deployment-safety.test.mjs netlify-rehearsal.test.mjs`, 모두 로컬 시뮬레이션 |
| 로컬 공개 산출물 | 통과 1개 | `pages-artifact.test.mjs`: 기존 3페이지, 저장소 하위경로, 모바일, 비공개 파일 404. 실제 Pages 게시 아님 |
| 공개 허용 목록/원본 바이트 일치 | 통과 | 101개 파일 중 기억의 좌표 20개. 새 클라이언트 JS 2개만 추가. 서버/SQL/테스트/문서는 게시 제외 |
| 기존 교사용 사전 배포 점검 화면 | 로컬 미검증 | 관리형 Chromium이 `file://` 탐색을 `ERR_BLOCKED_BY_ADMINISTRATOR`로 차단. 설정 우회 안 함 |
| 기존 Windows 네이티브 TLS/ACL | 로컬 미검증 | Linux 작업 환경에 `pwsh` 없음; ACL 검사는 Windows 전용. 실제 Windows 시험은 CI 결과와 구분 |
| 기존 Firebase Rules Emulator | 로컬 미검증 | demo 전용 Emulator 기동/HTTP 401 응답 확인. 테스트 실행이 응답 없이 멈춰 중단; Rules 변경 없음 |
| 호스팅된 테스트 Firebase/Supabase | 미검증 | 서버 설정/자격 증명 미제공. 로컬 가상 Firebase/객체 저장소 + 실제 PostgreSQL WASM으로 검사 |
| 운영 Firebase Rules/Supabase/학생 자료/Pages | 변경 안 함 | 적용·배포 명령 실행 안 함, PR Draft 유지. Netlify 잠금 변경 안 함 |

## 신규 권한 검사 내용

- 7학교 개별 발급/교사 전용 관리/익명 학생 전용 교환.
- 다른 UID·다른 학교의 grant 재사용 거절, 만료된 invite/grant 거절, 유효 링크 없는 인증코드 대체 제출 거절.
- 초대/권한 SHA256 해시 저장, public/anon/authenticated 테이블 및 RPC 접근 거절.
- 서로 다른 작품 수/전체 작품 수/파일 크기 상한, 동시 요청에서 한도 유지, 동일 키 재시도 중복 차감 방지, 파일 바꿔치기 거절.
- 전송 도중 폐기하면 최종 ready 거절/새 임시 객체 정리. 완료 작품은 폐기 후 실패한 재시도로 삭제되지 않음.
- 주소 fragment 즉시 제거. HTTP 요청 주소, Firebase 학생 기록, localStorage/sessionStorage에 토큰 패턴 없음.
- 390/820/1280px 화면, 학생 3단계, 학교 단일 선택, 별도 업로드 인증코드 입력 없음.
- 폐기된 링크로 제출 실패해도 선택 File/글 유지. 새 링크를 같은 화면에 연결해 재선택 없이 제출 완료. 잘못된 학교는 안내 후 거절하고 초안 유지.
- 새 권한으로 제출한 작품의 승인·공개·비공개 전환 시 다음 파일 요청 차단.

## 이번에 수정한 기존 CI 검사

기준 커밋의 Linux review가 실패한 로그를 확인했다. `browser.test.cjs`가 복원된 장소명을 재입력해 위치를 지운 뒤 비활성 확인 버튼을 클릭했으며, 뒤의 학교별 반복에서도 필수 장소명을 생략했다. 실제 학생 화면의 위치 안전장치는 유지하고, 테스트가 복원값 확인/필수 장소명 입력을 수행하도록 수정했다.

## 운영 승인과 복구 기준

구체적인 테스트 실행/서버 설정 준비는 [UPLOAD-INVITES-REVIEW.md](UPLOAD-INVITES-REVIEW.md) 참조. 호스팅 테스트, 학교 정책·한도·개인정보/로그 비저장 확인, 운영 활성화는 별도 승인 대상이다. 지금은 기존 기본 disabled 설정과 운영 entry를 유지한다. 테스트에서 학교/UID/만료/폐기 검사 중 하나라도 실패하면 초대 모드를 열지 않고 Draft 검토로 돌린다. 운영 자료를 지우는 방식으로 복구하지 않는다.

Notion 연결 도구가 없어 미반영. 반영 문구: 「기억의 좌표 LIVE PR #7 Draft에 학교별 시간 제한 업로드 링크를 추가. 로컬 PostgreSQL/가상 Firebase/Chromium 검증, 인증 실패 시 글·선택 파일 보존 확인. 운영 Rules/Supabase/학생 자료/main/Pages 변경 없음. 호스팅 테스트와 로그·보관·학교 정책 검토 후 별도 운영 승인 필요. 최종 SHA/CI 링크는 PR #7 최신 작업 보고 참조.」
