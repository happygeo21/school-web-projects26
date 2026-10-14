# Notion A4 회귀 검사

`notion-print.smoke.cjs`는 별도의 Chrome 세션과 127.0.0.1 임시 서버를 사용한다. 서버는 인쇄 도구 한 파일만 제공한다. 실제 클립보드·학생 자료·Firebase는 사용하지 않는다.

준비: Node.js, Playwright 패키지, Chrome. Playwright가 이 프로젝트에서 검색되지 않으면 `PLAYWRIGHT_MODULE` 환경 변수에 설치된 패키지 경로를 지정한다. 운영 HTML에 Playwright 의존성을 추가할 필요는 없다.

실행: `node tests/notion-print.smoke.cjs`

검증: JavaScript 구문, 빈 문서 1쪽, 글자·여백 변경, 저장·복원, 페이지 나눔 및 paste 이벤트 뒤 보존, 새 문서 이미지 폭, 자동 맞춤, 모바일/PC 3쪽 일치, 이미지 설정과 나눔 복원, 브라우저 오류 없음.

출력은 기본으로 시스템 임시 폴더에 저장되며 시작 시 경로를 출력한다. `TEST_OUTPUT_DIR`로 별도 경로를 지정할 수 있다. 화면 캡처, test-results.json, 1·2·3쪽 PDF를 생성한다. PDF의 실제 페이지 수는 PDF 뷰어 또는 pypdf 등 독립 도구로 확인한다. 이 테스트 자체는 PDF 내부 페이지 수까지 검사하지 않는다.

OS 인쇄 대화상자, 실제 Notion 클립보드, 복잡한 표·대형 이미지·모든 브라우저의 페이지 분할은 이 검사만으로 보장하지 않는다. 실제 인쇄 쪽수는 최종 인쇄 설정에 따라 달라질 수 있다.
