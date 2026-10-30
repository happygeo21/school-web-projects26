# KOSIS–eGIS 운영·복구 안내

## 버전과 담당

- 현재 운영 Pages main: `c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5` — 2026-10-23 기존 Pages 배포 성공 이력, 이번2026-10-30 HTTP200 확인. 개선판이 아닙니다.
- 기능 검증 기준: `17f9877e9ea62dfe65011b06f7223535a5a58d6a` / PR #8. 최종 정리는 같은 PR의 후속 커밋입니다. PR 최종 HEAD는 [PR #8](https://github.com/happygeo21/school-web-projects26/pull/8)에서 확인합니다.
- 개선판 운영 배포: **보류**. Netlify의 다른 앱에 대한 main 자동 게시 영향이 확인되기 전 병합하지 않습니다. 확인 후 정상 merge 및 Pages 실행 성공 SHA를 릴리스 기록에 추가해야 합니다.
- Codex: 코드/보안/패키지/CI/배포 및 운영 기록. 어사이드: 실제 KOSIS 원본·실제 e-GIS 지도·수업 사용 검증. [인수인계](aside-handoff.md).

대표 학생 URL: https://happygeo21.github.io/school-web-projects26/kosis-egis/ . `/kosis-egis-tool/`와 `/egis-student-guide/`도 유지합니다. [학생 사용법](spatial-units.md), [Windows 키트](windows-guide.md), [결과 체크리스트](classroom-checklist.md).

## 변경·배포 안전 기준

최종 변경 파일 목록은 `git diff --name-status c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5...HEAD`로 확인합니다. PR #8의 관련 폴더·문서·검증 워크플로·공개 allowlist만 허용합니다. PR7/기억의 좌표/happygeo/wedding-planner/Firebase/다른 앱/legacy와 Pages 배포 워크플로 자체는 수정하지 않습니다.

Pages는 main push 시 전체 allowlist를 재배포합니다. 다른 앱의 공개82개 파일은 main과 바이트 동일하고 삭제 파일이 없어야 합니다. 내부 docs/tests/Worker/환경파일은 공개 산출물에 넣지 않습니다. 정적 학생 변환에는 인증키·Secret이 필요하지 않습니다. 교사 Worker는 비공개 소스이며 이번 작업에서 배포/활성화하지 않습니다.

외부 라이브러리 SheetJS는 공식0.20.3 tarball에서 고정한 동일 출처 파일을 `kosis-egis-tool/vendor/`에 보관합니다. 라이선스를 함께 배포하고 package-lock의 무결성과 [출처·해시](sheetjs-provenance.json)를 대조합니다. 운영 화면과 오프라인 키트는 같은 파일을 사용합니다. 알려진 취약점0은 모든 보안 문제 부재에 대한 보증이 아닙니다.

## 재검사

Node.js22+, Python3는 키트 재생성 담당자만 필요합니다. 교사는 완성 ZIP과 Node.js만 사용합니다.

```bash
npm ci --ignore-scripts --prefix tests/kosis-egis
npm --prefix tests/kosis-egis test
npm --prefix tests/kosis-egis audit --ignore-scripts
node --test scripts/happygeo-fixture.test.cjs scripts/happygeo-content.test.cjs scripts/public-boundary.test.mjs
# 기존 _site는 보존해서 옮긴 뒤 새 폴더에서만 빌드
node scripts/build-public-site.mjs
node scripts/verify-public-site.mjs
# Playwright Chromium 또는 Windows Edge 경로를 CHROMIUM_PATH로 지정
node tests/kosis-egis/browser.test.cjs
python tests/kosis-egis/build_windows_kit.py /tmp/egis-새출력폴더
```

보안 감사가 취약점을 보고하면 자동 `npm audit fix --force`를 실행하지 않습니다. 공식 수정판·라이선스·해시를 확인하고 동일 기능 회귀검사 후 PR로 검토합니다. 실제 통계 테스트는 어사이드의 결과와 분리합니다.

## 배포 후 한 번 확인할 항목

1. 정상 GitHub merge 후 main SHA·KST와 Pages Actions 성공 실행을 기록합니다. 실제 공개3주소의 HTTP200과 HTML/JS/CSS/JSON/vendor 파일의 SHA256를 해당 커밋과 비교합니다.
2. 공개 학생 화면에서 시도17·전남22 연습, 실제 파일 입력/CSV·XLSX 다운로드, 공간 단위 불일치 차단을 한 번 확인합니다. 이를 실제 KOSIS 수치·e-GIS 지도 성공으로 표시하지 않습니다.
3. 다른 앱의 기존 URL/공개 자산을 배포 전 스냅샷과 비교합니다. Netlify Production 배포 ID·SHA·상태도 독립 확인합니다.
4. Notion 기존 관리대장 항목과 변경로그1건에 성공한 배포만 기록하고 읽어 확인합니다. 학생 제출 경로·기록은 바꾸지 않습니다. 연결이 없으면 [붙여넣기 문구](notion-update.md)를 사용합니다.

## 오류와 복구

오류 보고: URL·배포 SHA·KST·브라우저·재현 순서·화면 문구·민감정보 제거 최소표본·검증 JSON·SHA256. 공개 이슈에 실제 학생 파일·쿠키·키를 올리지 않습니다.

개선판이 아직 배포되지 않았다면 코드/데이터를 되돌릴 필요가 없습니다. 배포 후 문제가 생기면 다음을 따릅니다.

1. 마지막 정상 커밋과 배포를 확인하고 이슈를 기록합니다. Pages/Netlify의 실패인지 앱 오류인지 구분합니다.
2. 최신 main에서 별도 복구 브랜치를 만듭니다. PR #8의 merge commit을 GitHub의 **Revert**로 되돌리는 새 PR을 우선 사용합니다. 로컬이면 확인한 merge commit에만 `git revert -m 1 <merge-SHA>`를 적용하고 diff를 검토합니다. squash 병합이었다면 일반 revert 방식입니다.
3. 다른 앱·개인정보 보호 패치를 되돌리지 않는지 검사하고 CI/allowlist/82개 파일 무결성을 확인한 뒤 정상 PR 병합합니다. main reset·force push·과거 저장소 전체 복사는 금지합니다.
4. Pages 재배포와 공개 주소를 확인합니다. Netlify의 다른 프로젝트는 해당 담당자가 기존 운영 배포를 보존하고 이 eGIS 복구로 함께 갱신하지 않도록 확인합니다.
5. Firebase/학생기록/다른 앱 데이터는 복구 대상이 아닙니다. 데이터 삭제·복원이나 키 변경을 수행하지 않습니다.
