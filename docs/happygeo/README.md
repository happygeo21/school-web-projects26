# 에너지 결정사 · 2차시 개편 검토본

작업 브랜치: `codex/happygeo-two-lessons`. 운영 병합·Pages 배포·Firebase 운영 읽기/쓰기·규칙 변경은 실행하지 않았다.

## 구현

- 원본 학생/교사 HTML, 인증 설정, 기존 21문항과 믹스 기록은 보존한다. 홈에서 새 버전과 기존 버전으로 각각 접근한다.
- `student-v2.html`, `teacher-v2.html`: 50분 × 2차시, 5+5문항. 기존 9명 캐릭터와 3개 테마·관심 선택을 유지한다.
- 세계지도는 석탄 7개·원유 6개·천연가스 8개, 총 21개 대표 연결이다. 자원·운송수단 필터, 전체/선택 확대, 지역 이름, 연도·공식 근거를 제공한다. 실제 항로·관로·물동량·실시간 위치를 나타내지 않는다.
- 첫 팀 3명과 근거를 확정하면 별도로 보존한다. 돌발 5종(공급·기상·입지·탄소·가격)에 대응한 뒤 현재 팀과 개인 3문장 보고서를 함께 저장·조회한다. 자기 보고서를 TXT로 내려받을 수 있다.
- 새 데이터는 `energyMatchV10_3/{classCode}/students/{auth.uid}/lesson2026` 안에만 저장한다. 기존 학생의 `answers`, `scores`, `interests`, `opinions`, `mix`를 덮어쓰거나 이전 점수와 합산하지 않는다.
- Google/이메일 교사 인증과 학생 익명 인증을 유지한다. 서버 권한 실패는 명시적으로 실패 처리하고 로컬 저장으로 전환하지 않는다. 교사는 학급 부모 전체 대신 허용된 하위 노드를 읽는다.

## 참고 자료 반영

사용자가 제공한 시범 HTML·2차시 수업안·지도 PNG를 실제로 읽고 비교했다. 문서 안 제안은 참고 자료로 취급하며 사용자 요청과 저장소 보존 원칙을 우선했다. 참고안의 캐릭터 이름, 유한성·편재성·가변성, 석탄 용도, 국제 이동, LNG, 태양광 잠재력과 실제 발전량, 풍력 조건, 공급 다변화 10개 핵심을 반영했다. 단순 경로 암기보다 해석을 묻도록 문항 표현을 조정했다. 첫 선택과 수정 이유·개인 3문장도 반영했다.

교과서 쪽수 169–183은 참고안의 표기이며 판본별 정확성은 미확인이다. 원본 앱의 p04–p16 이미지는 그대로 분리 추출해 열람할 수 있게 했다. 참고 PNG를 복사하는 대신 출처와 자료연도를 경로마다 확인한 자체 SVG를 사용한다.

## 미리보기

일반 미리보기는 정적 HTTP 서버에서 `/happygeo/student-v2.html?demo=1`, `/happygeo/teacher-v2.html?demo=1`을 연다. 같은 브라우저에서 교사 데모로 가상 학급을 먼저 만든다. 데모는 운영 Firebase SDK·설정을 로드하지 않는다.

로컬 서버 소켓이 차단된 환경에서도 검토할 수 있다.

```sh
node scripts/build-happygeo-preview.cjs
```

저장소 바깥의 `../happygeo-review.html`에 CSS·이미지·데이터를 담은 단일파일이 생성된다. 브라우저에서 열고 위쪽의 교사/학생 링크로 이동한다. 실제 `file://` 열기, 교사 학급 생성→학생 입장, 외부 HTTP 요청 0건을 검증했다. 생성본은 검토용 데모이며 운영 배포 목록에 포함하지 않는다.

스크린샷: [학생](previews/student-desktop.png), [모바일](previews/student-mobile.png), [지도](previews/world-desktop.png), [지도 모바일 확대](previews/world-mobile-zoom.png), [교사](previews/teacher-desktop.png).

## 검증과 남은 확인

```sh
node --test scripts/happygeo-content.test.cjs scripts/happygeo-fixture.test.cjs scripts/public-boundary.test.mjs
node scripts/happygeo-v2.browser-test.cjs
node scripts/build-public-site.mjs
node scripts/verify-public-site.mjs
```

브라우저 테스트에는 Playwright 및 Chrome이 필요하다. `HAPPYGEO_BROWSER`로 브라우저 실행 경로를 지정할 수 있다. 테스트는 운영 네트워크를 차단하고 로컬 파일과 테스트 SDK만 공급한다. 빌드는 기존 `_site`가 없는 새 체크아웃에서 실행한다. PR 워크플로는 단위/계약·문법·공개 산출물만 검사하며 배포하지 않는다.

통과: 브라우저 6개 시나리오, 데이터/권한 대역 4개, 콘텐츠 계약 2개, 기존 공개 경계 1개. 모바일 390px·PC 1440px, JS 오류 0건·문서 가로 넘침 없음. 신규 노드 저장·새로고침 복원·교사 조회·이전 필드 보존·XSS 입력·저장 거부시 입력 보존을 확인했다.

**미확인:** 실제 Firebase Rules의 현재 내용과 안전성, 운영 교사 승인/거부 계정 로그인, 실제 학생 제출, 다른 기기 간 실시간 동기화. SDK 대역의 권한 검증은 실제 Rules 에뮬레이터 검증이 아니다. 승인 후 별도 테스트 환경에서 이 항목들을 확인해야 한다. 실제 교과서 판본 대조와 교실 50분 운영 적합성도 교사 최종 확인이 필요하다.

기본 브랜치 병합과 운영 Firebase 변경은 사용자 승인 전 실행하지 않는다.
