# 최종 릴리스 안전검사 — 게시 잠금 확인 및 배포 승인

검사일2026-10-30 KST. 기존 PR #8 / feat/kosis-egis-validation. 시작 HEAD `17f9877e9ea62dfe65011b06f7223535a5a58d6a`, 기존 main `c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5`. 실제 KOSIS·지도 조작을 반복하지 않고 기존 기능 유지·보안·배포 영향을 검사했습니다.

**이전 Netlify 게시 영향 차단 조건은 사용자 확인으로 해소됐습니다.** happygeo/veteransgeo 모두 Auto Publishing Locked, 기존 Published main@7bbedd6 유지, Production deploy/Agent Runner는 크레딧 소진으로 중단, Unlock하지 않음을 사용자가 확인했습니다. 확인 근거는 사용자 설정 화면 점검 보고이며 Codex가 잠금을 변경하거나 인증된 관리 화면을 직접 조회한 것은 아닙니다. 이번 요청의 승인을 기준으로 PR #8 정상 병합·Pages 배포를 진행하며 실제 결과는 [PR #8의 최신 배포 기록](https://github.com/happygeo21/school-web-projects26/pull/8)에서 확인합니다. 아래 차단 근거는 이전 검사 이력으로 보존합니다. 개발/배포와 실수업 승인을 구별합니다.

## 이전 병합 차단 근거와 해소 이력

| 확인 | 실제 결과 |
|---|---|
| Pages main push | `.github/workflows/pages.yml`이 전체 allowlist를 자동 빌드/배포. 워크플로 자체는 수정하지 않음 |
| 다른 앱 파일 | 기존 main의 eGIS 외 공개82개 파일 모두 바이트 동일. 공개 파일 삭제0. PR7/happygeo/wedding-planner/Firebase/legacy 소스 변경0 |
| Netlify 연결 | PR #8에서 happygeo·veteransgeo Deploy Preview ready 상태 및 Netlify 체크 확인 |
| Netlify 현재 운영본 | 두 사이트 공개 API의 published_deploy.commit_ref가 `7bbedd6f0bbb2e6c6d6e10087460ac140a67349e` / production main / state ready / published_at2026-10-19 |
| 운영과 main 차이 | happygeo Netlify는 ‘에너지 결정사 FINAL v10’이고 main/Pages는2차시 수업판. 두 사이트 index HTML SHA256 모두 현재 main과 다름 |
| 현재 설정 조회 한계 | 공개 Site API는 build_settings를 제공하지 않음. production 자동 게시/잠금·Base/Publish 미확인. deploy-preview URL은401(인증 필요). GitHub webhook 조회403 Resource not accessible by integration(권한 제한) |
| 체크 한계 | Netlify의 “All files already uploaded” 체크는 업로드 중복 여부이며 현재 Production과 동일하거나 main 게시가 막혔다는 증거가 아님 |
| 판정 | main 병합이 누적된 다른 앱 변경을 게시할 수 있는지 입증하지 못해 **병합 중단**. Netlify 설정을 임의로 바꾸거나 보호/인증을 우회하지 않음 |

이전 확인 요청 정보: happygeo·veteransgeo의 Production branch / Base directory / Publish directory / 자동 게시·게시 잠금 상태. 두 사이트의 운영 배포가 의도치 않게 바뀌지 않음이 확인돼야 이번 승인 범위의 정상 merge를 재개할 수 있습니다. 다른 프로젝트 자동 배포를 일방적으로 변경하지 않습니다.

## 기능·공개 파일 검사

- 두 변환기 HTML이 동일하며 core.js/spatial.js/app.js/Worker를 공유합니다. 기존 별도 인라인 엔진을 새로 만들지 않습니다.
- 학생 기본 동작은 브라우저의 파일 처리이며 키·로그인·서버 Secret이 필요하지 않습니다. 교사용 API Worker는 공개 allowlist에 없고 이번에 활성화/배포하지 않습니다.
- 시도17·시군구252 기준표와 실제 경계 원본을 유지했습니다. 전남22는 선택 범위이며 모든 원본에 지역 수를 강제하지 않습니다.
- 기준표·CSS·JS·vendor·경계·공식 검색 JSON을 명시적 allowlist에 포함합니다. 공식 수정 라이브러리와 라이선스2개를 추가해 공개 후보는102개입니다. docs/tests/백업/서버/비공개 설정은 제외합니다.
- 공개 eGIS 파일의 GitHub/Notion/AWS 토큰·개인키 패턴은 검출0. 이 제한된 정적 검사는 유출 없음 전체 보증이 아닙니다. 공개 산출물 밖의 legacy와 Git 이력은 보존합니다.
- 기존 학생·교사·제출·Notion URL을 바꾸지 않았습니다. 중복 PR과 새 API/디자인 개편은 만들지 않습니다.

## 발견한 의존성 보안 문제와 조치

최종 npm audit에서 기존 xlsx0.18.5의 high1개 패키지(2개 권고: GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS)를 확인했습니다. 학생 화면의 외부 스크립트도 같은 버전이므로 QA 전용 문제로 취급하지 않았습니다.

공식 `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`를 정상 HTTPS/관리형 프록시로 확보했습니다. 공식 배포 패키지0.20.3을 package-lock 무결성으로 고정하고 배포용 vendor 파일·라이선스를 같은 패키지에서 복사했습니다. 별도 외부 스크립트 URL은403이어서 운영 화면은 검증한 로컬 파일을 사용합니다. 인증·네트워크 정책을 변경하지 않았으며 허용된 공식 패키지 배포 경로를 사용했습니다. [원본 해시·라이선스](sheetjs-provenance.json).

교체 후 npm audit의 알려진 취약점은0입니다. 임의 `audit fix --force`나 다른 앱의 라이브러리·legacy 수정은 하지 않았습니다. 모든 보안 결함이 없다는 보증은 아닙니다. Windows CI에서 vendor 파일의 Git 줄바꿈 자동 변환을 해시 불일치로 탐지해 패키징을 중단했습니다. vendor 폴더에만 -text 속성을 지정해 공식 원본 바이트를 보존하며 해시 검사는 완화하지 않았습니다. 최종 Windows 재검사는 PR 최신 실행을 따릅니다.

## 검사 상태와 실행 근거

- 기존 기능 기준17f9877: [Linux·Windows/CMD·Edge18](https://github.com/happygeo21/school-web-projects26/actions/runs/41009231762) 성공, [공개 파일 안전검사](https://github.com/happygeo21/school-web-projects26/actions/runs/41009231794) 성공, [다른 앱 회귀](https://github.com/happygeo21/school-web-projects26/actions/runs/41009231782) 성공.
- 보안 교체 후 최종 소스/브라우저/Windows 키트 CI는 같은 PR #8의 최신 실행을 기준으로 판정합니다. 통과 개수는 기존 엔진28·공간27·Worker4·브라우저18·키트23·다른 앱 회귀3파일입니다. 새 통계 테스트는 추가하지 않았습니다.
- 실제 KOSIS 원본 전수·e-GIS 지도·학교 PC/학생 독립 사용: **미검증, 어사이드 이관**.
- 개선판 실제 공개 업로드/변환/다운로드: **미검증, 개선판 미배포**. 로컬/CI 통과로 운영 기능 성공을 대신하지 않습니다.

## 실제 공개 주소 검사

다음은 배포 전 **기존 운영판**의 HTTPS200입니다. 개선판 공개 성공이 아닙니다.

- https://happygeo21.github.io/school-web-projects26/kosis-egis/ — 기존 시군구 변환기
- https://happygeo21.github.io/school-web-projects26/kosis-egis-tool/ — 기존 시군구 스튜디오
- https://happygeo21.github.io/school-web-projects26/egis-student-guide/ — 기존 학생 안내
- 기존 Pages happygeo / veteransgeo / wedding-planner 및 두 Netlify 루트도200 확인. 공개 응답과 소스 해시를 별도로 기록했으며 Firebase/학생자료를 읽거나 쓰지 않았습니다.

배포 전 main은 c5ef2c1이며 복구 비교 기준으로 보존합니다. 신규 운영 merge SHA·KST·Pages 성공 실행·실제 공개 자산과 기능 결과는 PR #8 배포 기록을 확인합니다. 실수업 승인은 어사이드의 실제 검증과 별도입니다.

## 인계와 최소 후속 작업

1. 사용자 확인한 Netlify 두 사이트의 Auto Publishing Locked를 유지하고 운영 Published 커밋을 전후 비교합니다.
2. 최종 CI 성공·전체 diff·민감정보/allowlist·다른 앱 무결성을 확인한 뒤 PR #8만 정상 병합합니다. 우회/force push/main reset은 금지합니다.
3. Pages 성공과 실제3URL 자산·업로드·연습·CSV/XLSX 다운로드 및 다른 앱 URL을 한 번 확인하고 운영 SHA·KST를 기록합니다.
4. [어사이드](aside-handoff.md)에 시도/시군구 지도1개씩의 실전 검증을 인계합니다. [유지관리·복구](operations.md), [Notion 붙여넣기](notion-update.md)를 사용합니다. 현재 Notion 연결이 없어 미반영입니다.
