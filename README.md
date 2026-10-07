# 🌍 school-web-projects26

지리 수업·학생 활동·교사업무를 위해 만든 웹도구 모음입니다.  
**Notion은 안내와 수업자료**, **GitHub는 프로그램 원본과 버전관리**에 사용합니다.

## 프로젝트 바로가기

| 프로젝트 | 용도 | 폴더 |
|---|---|---|
| 🧭 **기억의 좌표 LIVE** | 7개 학교 공동 보훈·장소 탐구, 학생 입력·교사 검토·공개지도 | [`veteransgeo/`](./veteransgeo/) |
| 💘 **에너지 결정사** | 에너지 자원 소개팅형 수업, 학생 활동·교사 대시보드 | [`happygeo/`](./happygeo/) |
| 🌍 **KOSIS → e-GIS 변환 스튜디오** | KOSIS Excel/CSV를 e-GIS 결합용 자료로 정리·검증 | [`kosis-egis/`](./kosis-egis/) |
| 🖨️ **Notion A4 Print Studio** | Notion 내용을 A4에 맞춰 편집·자동맞춤·인쇄 | [`notion-print/`](./notion-print/) |


## GitHub Pages 공개 주소

GitHub Pages가 활성화되면 아래 주소를 기본 공개 주소로 사용할 수 있습니다.

- 통합 허브: https://happygeo21.github.io/school-web-projects26/
- 기억의 좌표 LIVE 학생용: https://happygeo21.github.io/school-web-projects26/veteransgeo/
- 기억의 좌표 교사용: https://happygeo21.github.io/school-web-projects26/veteransgeo/teacher.html
- 기억의 좌표 공개지도: https://happygeo21.github.io/school-web-projects26/veteransgeo/public.html
- 에너지 결정사 시작화면: https://happygeo21.github.io/school-web-projects26/happygeo/
- 에너지 결정사 학생용: https://happygeo21.github.io/school-web-projects26/happygeo/student.html
- 에너지 결정사 교사용: https://happygeo21.github.io/school-web-projects26/happygeo/teacher.html
- KOSIS → e-GIS 변환 스튜디오: https://happygeo21.github.io/school-web-projects26/kosis-egis/
- Notion A4 Print Studio: https://happygeo21.github.io/school-web-projects26/notion-print/

> Netlify는 삭제하지 않고 기존 주소를 유지합니다. GitHub Pages는 별도의 공개 경로로 추가되며, `main` 브랜치에 커밋되면 GitHub Actions를 통해 자동 배포되도록 구성합니다.

## 권장 운영 방식

```text
Notion
  └─ 학생 안내 · 수업자료 · 링크 허브
        ↓
GitHub
  └─ HTML · JavaScript · CSS 원본 및 수정 이력
        ↓
Netlify / GitHub Pages
  └─ 학생이 실제로 접속하는 웹사이트
        ↓
Firebase (필요한 프로젝트만)
  └─ 로그인 · 학생 제출 · 실시간 데이터
```

## 파일 관리 원칙

- 실행 파일 이름은 가능한 한 항상 `index.html`, `student.html`, `teacher.html`처럼 유지합니다.
- `최종(1).html`, `진짜최종.html`처럼 파일을 늘리지 않고 **GitHub Commit 이력**으로 버전을 관리합니다.
- 수정할 때는 프로젝트 폴더 안의 기존 파일을 업데이트합니다.
- 큰 기능 변경 전에는 기존 Commit을 기준점으로 남겨 언제든 이전 버전으로 돌아갈 수 있게 합니다.

## 프로젝트별 기준 파일

### 🧭 기억의 좌표 LIVE
- 학생용: `veteransgeo/index.html`
- 교사용: `veteransgeo/teacher.html`
- 공개지도: `veteransgeo/public.html`
- 학교·지역 설정: `veteransgeo/project-config.js`
- Firebase 연결: `veteransgeo/firebase-config.js`

### 💘 에너지 결정사
- 시작화면: `happygeo/index.html`
- 학생용: `happygeo/student.html`
- 교사용: `happygeo/teacher.html`
- Firebase 연결: `happygeo/firebase-config.js`
- 업데이트 안내: `happygeo/GITHUB_UPDATE_GUIDE.md`

### 🌍 KOSIS → e-GIS
- 실행 파일: `kosis-egis/index.html`
- 브라우저에서 파일을 처리하며 원본 파일은 서버에 업로드하지 않습니다.

### 🖨️ Notion A4 Print Studio
- 실행 파일: `notion-print/index.html`
- Notion 본문을 복사·붙여넣어 글자 크기, 여백, 줄간격, 이미지 크기, 목표 페이지 수를 조절합니다.

---

### 앞으로의 수정 요청 예시

> `GitHub school-web-projects26의 kosis-egis 현재 버전을 기준으로 ○○ 기능만 수정해줘.`

> `happygeo/student.html은 유지하고 캐릭터 이름과 결과 화면만 업데이트해줘.`

이 방식으로 요청하면 현재 GitHub 파일을 기준으로 수정하고, 변경 내용은 Commit 기록으로 남기는 것을 원칙으로 합니다.
