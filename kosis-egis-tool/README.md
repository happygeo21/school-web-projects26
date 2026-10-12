# KOSIS → eGIS 시군구 변환기

GitHub Pages에서 CSV 변환을 실행하는 정적 사이트입니다. KOSIS API 인증키는 절대로 이 저장소에 입력하지 마세요.

- 웹 경로: https://happygeo21.github.io/school-web-projects26/kosis-egis-tool/
- 웹 파일: index.html, app.js
- 서버 중계: worker/index.js (Cloudflare Worker에 **별도로** 배포)
- CSV 결과 열: name,code,value

## 설정
1. school-web-projects26 저장소 Settings → Pages에서 main 브랜치 배포를 활성화합니다.
2. Cloudflare Workers에 worker/index.js를 붙여넣고 배포합니다.
3. Worker의 Secret에 KOSIS_API_KEY를 지정합니다. 이 채팅에 노출한 이전 키는 가능하면 재발급하세요.
4. Worker 변수 ALLOWED_ORIGIN은 https://happygeo21.github.io 로 설정합니다.
5. 사이트에서 Worker URL을 입력하거나 KOSIS CSV를 업로드합니다.
6. 기존 252개 지역 기준 CSV를 업로드하여 지역명/코드 열과 통계값 열을 선택한 후 검증하고 내려받습니다.

## 주의
- 이 프로젝트는 KOSIS API 실호출 및 252개 기준표 병합 실측 검증 전의 초기 버전입니다.
- Origin 제한은 인증 수단이 아닙니다. Worker의 무단 호출 방지를 위해 별도 인증 및 Rate Limiting을 권장합니다.
- eGIS 기준표의 행정구역 경계/연도와 KOSIS 지역 단위가 같아야 합니다.
- 통계표마다 분류 및 항목 코드가 다릅니다.
- 결측값은 0으로 대체하지 않습니다.
