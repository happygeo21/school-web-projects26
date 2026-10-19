# GitHub / Netlify 공개 배포 및 개인정보 보안 점검

점검일: **2026-10-19 (KST)**

> 이 보고서는 GitHub 접근 가능한 공개 저장소의 경로·주요 웹 파일·커밋 메타데이터와 사용자가 제공한 Netlify Deploys 스크린샷에 근거합니다. 운영 Firebase Rules, GitHub 계정 보안 설정 및 Netlify 게시 폴더는 직접 조회하지 못했습니다. **유출 없음에 대한 보증이 아닙니다.**

## Netlify 배포 진단

- Site: [veteransgeo](https://app.netlify.com/projects/veteransgeo/overview)
- 사용자 화면: `main@bc32bca`, `Production Published`, **2026-10-19 11:41 KST**. Auto publishing ON.
- 결론: 자동 배포는 작동함. 새 수동 배포 토큰/워크플로가 불필요하여 기존 `.github/workflows/deploy-veteransgeo-netlify.yml` 제거: [커밋](https://github.com/happygeo21/school-web-projects26/commit/5b5c16ad83fe0ee3c888628066f21f2e6a9db62f).
- **남은 확인**: [Netlify 모노레포 안내](https://docs.netlify.com/build/configure-builds/monorepos/)에 따라 해당 사이트의 Base/Package/Publish directory 확인. `veteransgeo` 프로젝트 홈페이지가 `veteransgeo/index.html`을 표시해야 합니다. `happygeo`는 `happygeo/index.html`을 사용해야 합니다. 스크린샷만으로 배포된 실제 HTML 일치를 입증할 수 없습니다.

## 점검 범위

- GitHub 계정 `happygeo21`의 접근 가능한 저장소 15개: **모두 public**.
- 15개 저장소 기본 브랜치의 추적 경로 확인. 공개 원본을 Fork한 저장소 14개는 유지하면서 원본 및 개인 보안 설정을 구별하여 검토함.
- `school-web-projects26`의 Firebase 설정·교사 인증·학생 제출·공개지도 코드·보안 문서·Actions 등 관련 파일 점검. 일부 대용량 파일과 Git 히스토리 전체는 자동 정밀 검사 범위가 아니었음.

## 발견 사항과 실제 조치

| 항목 | 위험 또는 진단 | 조치 | 상태 |
|---|---|---|---|
| 잘못된 Firebase 전체 허용 규칙 예시 | `happygeo/firebase-rules-merge-helper.html`은 `energyMatchV10_3`에 무인증 읽기/쓰기를 모두 허용하는 예시를 복사하도록 유도 | 기존 원클릭 위험 규칙을 삭제하고 안전 점검 안내로 변경. [커밋](https://github.com/happygeo21/school-web-projects26/commit/5952a620fd5eab3770c3baa26b10aa409c2cf967) | **코드 조치 완료**, 실제 운영 규칙은 미확인 |
| 보훈 교사용 CSV 수식 주입 | 학생 자유입력 문자열이 스프레드시트에서 수식으로 실행될 가능성 | CSV 내 위험 시작 문자 이스케이프. [검증 후 수정 커밋](https://github.com/happygeo21/school-web-projects26/commit/f34d4758408f6eecacc8c7d125b7106fefc57321) | **코드 조치 완료** |
| 비밀 파일 실수 업로드 | 루트 `.gitignore` 미존재 | `.env`, 개인키, Firebase Admin SDK, 학생 개인자료 폴더 등을 제외하도록 추가 | **예방 조치 완료** |
| 공개 저장소 보안 정책 | 개인정보·비밀키 운영 규칙이 산재 | [SECURITY.md](../../SECURITY.md) 추가 및 운영 수칙 명시 | **완료** |
| Netlify 토큰 기반 수동 배포 | 자동 배포가 이미 작동하는데 추가 토큰과 실행 경로를 권장 | 중복 Actions 워크플로 제거 | **완료** |
| Git 커밋 작성자 이메일 | 최근 커밋 40건 모두 `noreply`가 아닌 작성자 이메일 메타데이터 포함 | 향후 커밋 신원 설정 변경은 사용자 GitHub/로컬 Git 설정 필요 | **추가 조치 필요** |
| 공개 Firebase 설정 파일 | `happygeo/firebase-config.js`, `veteransgeo/firebase-config.js`에 Firebase Web API key 존재 | 웹 클라이언트에 필요한 공개 설정이며 그 자체로 비밀키 유출은 아님. Firebase Rules·App Check/API 제한 검증 필요 | **운영 규칙 확인 필요** |

## 서비스 중단 없는 사용자 점검

1. GitHub 계정 **Settings → Emails**에서 이메일 비공개/비공개 `noreply` 커밋 주소 확인. 이후 로컬 Git과 Codex 커밋 작성자 이메일을 이 주소로 설정. 과거 커밋은 현재 설정만으로 숨겨지지 않음.
2. GitHub 계정 **Settings → Password and authentication**에서 2FA/passkey, 로그인 세션 점검. **Developer settings**에서 활성 토큰·승인 앱·SSH 키 정리.
3. [저장소 보안 설정](https://github.com/happygeo21/school-web-projects26/settings/security_analysis)에서 Secret scanning, Push protection, Dependabot/Code scanning 상태 확인 및 가능한 보호 활성화.
4. **Firebase Console → Realtime Database → Rules**에서 보훈 `submissions`은 승인된 교사만 전역 읽기, 학생은 자신의 UID로만 쓰기가 가능한지 확인. `published`만 공개 읽기를 허용. 에너지 활동도 `energyMatchV10_3`의 무인증 접근을 차단해야 함.
5. **Netlify → veteransgeo → Project configuration → Developer settings → Continuous deployment → Build settings**에서 디렉터리 확인. 페이지 제목이 `기억의 좌표 LIVE`인지 확인.
6. GitHub Pages와 Netlify 배포 실행은 성공했어도 Firebase 운영 보안 규칙 검증과 실제 페이지 내용 일치는 별개로 관리.

**주의:** 공개 Git 저장소에서 비밀값이 발견되면 파일 삭제보다 **먼저 토큰·키를 회수/교체**해야 합니다. 과거 커밋 재작성은 Fork·배포에 영향을 주므로 일방적으로 수행하지 않습니다.
