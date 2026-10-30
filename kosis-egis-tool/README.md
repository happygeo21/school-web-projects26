# KOSIS → e-GIS 시도·시군구 변환기

대표 학생용은 `/kosis-egis/`입니다. 저장소 README와 학생 안내가 가리키던 URL을 유지합니다. `/kosis-egis-tool/`도 동일 화면과 공통 엔진을 사용하며 legacy는 수정하지 않습니다. 기존의 두 인라인 변환기를 `core.js`로 통합했습니다. 최초 소스는 Git 기준 커밋 `c5ef2c140c3a1eaa740fa1a14bd7c9b247b322a5`에서 복원·비교할 수 있습니다.

## 학생 사용법

1. 공식 KOSIS에서 지표를 검색하고 같은 공간 단위·연도·항목의 XLSX/XLS/CSV/TXT를 받습니다. 파일을 넣거나 전남 22개 **합성 연습자료**로 시작합니다.
2. 지역명·시도·코드 열, 통계 열과 자료 연도·분석 범위를 확인합니다. 서울 중구처럼 시도가 포함된 지역명 또는 별도 시도 열이 필요합니다. 표가 복잡하면 헤더 시작 행·줄 수와 시트를 선택합니다.
3. 변환 결과에서 정상 결합·중복·합계·미매칭·범위 내 누락·빈값을 각각 확인합니다. 잘못 인식한 행을 직접 지정·제외할 수 있습니다. 중복 연도·항목·수치 오류는 원본을 고쳐 다시 넣습니다. CSV/XLSX 또는 상세 JSON 검증 보고서를 받습니다.
4. e-GIS의 실제 경계 속성 테이블에서 지도 쪽 키를 확인하고 CSV `code`와 결합합니다. 레이어 키 이름을 가정하지 마세요. 결과 고유 지역 수와 원본 숫자를 대조한 뒤 단계구분도를 만듭니다.

`결합 가능`은 선택한 범위에서 중복·누락·빈값 없이 엔진 검사를 통과했다는 뜻입니다. 실제 e-GIS 결합 성공 인증이 아닙니다. 일부 표본·기준연도 불일치는 `확인 필요`, 코드·이름 불일치나 중복·수치 오류는 `결합 중단`입니다. 중단 상태에서는 지도용 저장을 막고 보고서는 저장할 수 있습니다. 수동 지정은 보고서에 기록합니다.

## 파일과 기준표

- CSV/TXT: UTF-8 BOM/UTF-8/EUC-KR 자동 디코딩, CSV 인용부호·줄바꿈·탭을 처리합니다. 중복 헤더는 번호로 구분합니다.
- XLSX/XLS: 공식 배포 패키지에서 검증한 SheetJS `0.20.3`을 같은 사이트의 고정 파일로 제공합니다. 여러 시트·병합 헤더는 선택 후 구조를 확인하세요. 라이브러리를 읽을 수 없으면 CSV로 저장해 다시 넣습니다. 2026-10-30 알려진 취약점 검사 결과와 원본 해시는 릴리스 문서에 기록합니다. 신뢰할 수 있는 KOSIS 파일만 넣으세요.
- 20MB·100,000행·500열 제한. 변환은 Web Worker로 실행해 화면을 계속 조작할 수 있습니다. Excel 파싱 자체는 메인 스레드이므로 큰 파일은 KOSIS에서 범위를 줄이는 편이 좋습니다.
- CSV: `code,name,sido,sido_name,base_year,선택 통계열...`, UTF-8 BOM. 값 0·음수·소수·퍼센트포인트를 보존하고 결측을 0으로 바꾸지 않습니다. 잘못된 숫자는 보고하고 비웁니다. CSV를 Excel에서 열 때 코드를 텍스트로 가져오세요. XLSX의 코드·시도 코드는 텍스트 셀입니다.
- `reference.json`은 기존 2025년 252개 내장 기준표를 그대로 추출했습니다. 현재 실제 레이어의 원본 파일은 제공되지 않아 공식 레이어와의 전수 일치는 **미검증**입니다. 252개가 모든 통계표의 지역 수라는 의미는 아닙니다.
- 교사용 기준 CSV는 `code,name,sido,sido_name,base_year`를 포함해야 하며 중복·코드 형식·시도 접두·연도를 검사합니다. 과거 코드나 상위 시 값을 일반구에 자동 복제하지 않습니다.

## 실행·테스트

Node.js 22 이상과 Python 3 권장. 앱 자체는 패키지 설치 없이 정적 서버에서 실행합니다. 저장소 루트를 공개 서버에 노출하지 마세요.

```bash
node tests/kosis-egis/core.test.cjs
node tests/kosis-egis/worker.test.mjs
node tests/kosis-egis/generate-fixtures.cjs
# _site가 없어야 합니다. 기존 출력이 있으면 보존 후 별도 위치로 이동하세요.
node scripts/build-public-site.mjs
node scripts/verify-public-site.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory _site
```

브라우저 QA 의존성은 앱과 분리했습니다.

```bash
cd tests/kosis-egis
npm ci --ignore-scripts
npx playwright install chromium
CHROMIUM_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")" npm run test:browser
```

이미 설치된 Chromium은 `CHROMIUM_PATH=/usr/bin/chromium`으로 선택합니다. 별도 설치 경로는 `PLAYWRIGHT_NODEJS_PATH`(playwright 모듈 탐색 루트), `KOSIS_QA_MODULES`(xlsx를 포함한 node_modules 경로)로 지정할 수 있습니다. 브라우저 테스트는 배포 대상의 고정 SheetJS 파일을 로컬 서버에서 직접 불러오며 외부 요청은 차단합니다. 생성 화면에는 합성자료만 사용합니다.

## 교사용 API Worker — 별도 배포 필요

`worker/index.js`는 정적 산출물에 포함하지 않습니다. 다음 바인딩이 없으면 HTTP 503으로 차단합니다.

- Secret `KOSIS_API_KEY`: Cloudflare의 보안 설정에서만 입력. 클라이언트·저장소·채팅에 넣지 않습니다.
- `ALLOWED_ORIGIN`: 정확한 학생 사이트 origin. CORS이며 인증이 아닙니다.
- `AUTH`: 교사 세션을 검증하는 **service binding**. 원래 요청 헤더·쿠키가 전달됩니다. 인증 성공 시 상태 200과 검증된 `X-Teacher-Id` 헤더를 반환해야 합니다. 단순히 클라이언트 헤더를 되돌려주면 안 됩니다.
- `RATE_LIMITER`: Cloudflare rate limiting binding. `limit({key:teacherId})`로 `{success}` 반환. 정책과 한도는 배포자가 설정합니다.

교사용 Worker 주소는 기본값을 비워 무단 호출을 유도하지 않습니다. 브라우저는 credentials를 포함하므로 실제 인증 도메인의 쿠키 SameSite·HTTPS·CORS 정책과 로그인 절차도 배포자가 구성해야 합니다. 이 저장소는 인증 서비스를 새로 배포하지 않습니다. 샘플 모의 테스트가 통과해도 실제 교사 인증·실 API 호출은 별도 검증이 필요합니다. 기존 공개 Worker는 코드 커밋만으로 변경되지 않으므로 운영자가 인증·rate limit을 적용하거나 중지해야 합니다.

진단·결과·실제 서비스 수동 검증은 [점검 보고서](../docs/kosis-egis/review.md)를 참고하세요.

## 수업 준비 후속 검증

[Windows 실행·실제자료 전수 대조 안내](../docs/kosis-egis/windows-guide.md)와 [수업 체크리스트](../docs/kosis-egis/classroom-checklist.md)를 참고하세요. 학생 화면은 원본값대조 CSV·JSON 및 XLSX 시트를 함께 제공합니다. 이는 파일 내부의 변환 전후 점검이며 실제 KOSIS 출처 검증·교사가 다운로드한 파일과의 독립 비교·지도 UI 검증을 대신하지 않습니다.

개발자가 검토한 체크아웃에서 `python3 tests/kosis-egis/build_windows_kit.py /tmp/새폴더`로 오프라인 키트를 재생성할 수 있습니다. 먼저 tests/kosis-egis에서 npm ci --ignore-scripts가 필요합니다. 교사 PC에서는 완성 ZIP과 Node.js22 이상만 필요합니다.

## 화순군2024 원본코드 확인

원본표·항목에 따라46790 / 1236370 / 2017zone_3637을 별개 코드체계로 취급합니다. 원본 통계표를 선택하고 전라남도·2024년을 확인한 화순군 한 지역 교차표만 GIS46790으로 연결합니다.12760은 이름만으로 채택하지 않습니다. 인식된 원본코드는 열 선택을 해제해도 검증하므로 미확인 코드를 이름매칭으로 우회할 수 없습니다. 사용자 기준수치와 공식원본·전남전수의 차이는 [후속 보고](../docs/kosis-egis/hwasun-2024-followup.md)를 참고하세요.

## 공간 단위 선택형 확장

첫 화면의 전국 시도 / 전국 시군구 / 특정 시도 / 자동 추천으로 시작합니다. `spatial.js`가 기존 `core.js` 앞에서 단위를 분석하고 학생 확인·불일치 차단·시도 직접 결합·안전한 집계를 처리합니다. 기존 시군구 엔진은 그대로 유지합니다.

실제 e-GIS 배포 시도17 경계·기준표와 원본 provenance를 포함했습니다. 통계청 출처는 e-GIS 카탈로그 표기를 확인한 것으로 원기관 파일 독립 대조와 실제 지도 UI는 미검증입니다. 상세 [공간 단위·집계·검증 구분](../docs/kosis-egis/spatial-units.md)을 참고하세요. `node tests/kosis-egis/spatial.test.cjs`로 공간 단위27개 검사를 실행합니다. 실제 KOSIS 원본과 실제 지도 제작 성공을 합성·로컬 화면 테스트로 대신하지 않습니다.
