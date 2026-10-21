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


## 2026-10-19 AI 도구·배포 업데이트 (KST)

- 🧩 [GitHub → AI 도구 연결 도우미](./tools/github-ai-connector/) — HWPX Skill·OpenSlide 설치 안내 및 공개 저장소 분류
- 🗂 [2026-10-19 GitHub / Notion / Netlify 점검 기록](./docs/integrations/2026-10-19-sync.md)
- 🔐 [2026-10-19 공개 GitHub / Netlify 보안 감사 및 조치 내역](./docs/security/security-audit-2026-10-19.md)
- 🚀 **Netlify 자동 배포 확인 (2026-10-19 11:41 KST)** — 사용자가 제공한 Netlify Deploys 화면에서 `veteransgeo`가 `main@bc32bca`를 Published로 표시함. 별도 토큰을 요구하는 수동 배포 워크플로는 보안상 제거. 실제 게시 폴더와 페이지 내용은 추가 확인 필요.
- ⏰ 파일별 정확한 반영 일시는 GitHub 커밋 타임스탬프를 기준으로 확인합니다.

## 외부 교사업무 도구 (출처 링크)

| 도구 | 활용 | 공식 사이트 · 출처 |
|---|---|---|
| 🎤 **행사박사** | 학교 의식행사 사회 대본 준비, 진행 순서 및 음원 운영 | [바로 사용](https://ahnbagsa.github.io/event/) · [원본 개발 저장소: Ahnbagsa/event](https://github.com/Ahnbagsa/event) |
| 📄 **kordoc 공문 만들기 간편판** | AI 초안을 HWPX 공문서로 변환 | [출처와 이용 안내](./tools/kordoc-simple/README.md) |

> 외부 제작 프로그램은 원본을 복제하거나 수정하지 않고 공식 사이트로 연결합니다. 각 프로그램의 저작권 및 이용 조건을 존중합니다.

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

## 이미지 제작 스타일 100

- 🎨 [AI 이미지 스타일 100 — 검색형 라이브러리](./image-style-library/) (검색·키워드·교사용 프롬프트 구성)
- [Notion 검색 색인](https://app.notion.com/p/400abbdcebdc81dcb60efaac72a3515d) · [원본 200개 프롬프트](https://www.jjcreative.co.kr/lounge/imgcode)
- 이미지 제작 후보 3~4개 추천 지침: [`image-style-library/AGENTS.md`](./image-style-library/AGENTS.md). 원본 상세 프롬프트 및 예시 이미지는 저작권 존중을 위해 원 사이트로 안내합니다.
