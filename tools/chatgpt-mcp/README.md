# ChatGPT × Korean AI tools 연결 가이드

> 관리 목적: ChatGPT용 한국어 문서 처리(kordoc)와 국내 실무 스킬(k-skill) 재사용 가이드. 기존 학교 웹 프로젝트와 분리된 문서 폴더입니다.

## 상태
- korean-law-mcp: 사용자가 ChatGPT에 연결했다고 확인함.
- kordoc: 설치/연동 준비 중. ChatGPT의 MCP 연결 완료 상태가 아님.
- k-skill: 스킬 집합이며 단일 원격 MCP URL이 아님. ChatGPT 연결 완료 상태가 아님.

## 원본 및 설치
- [kordoc](https://github.com/chrisryugj/kordoc) — HWP/HWPX/PDF/DOCX/XLSX 등을 다루는 CLI·MCP. Node.js >=20.
- [k-skill](https://github.com/NomaDamas/k-skill) — Codex/Claude Code 등의 스킬 모음. Node.js >=18.

Windows PowerShell:

```powershell
node --version
npx -y kordoc setup
npx --yes skills add NomaDamas/k-skill --list
```

선별 스킬 예시:

```powershell
npx --yes skills add NomaDamas/k-skill --skill kosis-stats --skill hwp --skill rhwp-edit --skill korean-spell-check -g
```

> 설치기는 지원하는 로컬 AI 에이전트에 등록합니다. ChatGPT 웹에 자동 연결되는 것은 아닙니다.

## ChatGPT 연동 시 확인할 사항
1. ChatGPT 계정의 앱/개발자 모드에서 사용자 지정 MCP 앱 추가가 실제 지원되는지 확인.
2. **kordoc**: 본래 로컬 stdio MCP이므로 ChatGPT가 접근 가능한 **안전한 원격 HTTPS MCP 엔드포인트** 또는 공식 지원 터널/브리지가 필요. 사용자 파일 시스템 전체를 노출하지 말 것. 서버의 인증·접근제어를 갖출 것.
3. **k-skill**: 개별 스킬은 단순 지침 또는 CLI 연동일 수 있으며 원격 MCP 엔드포인트가 아님. 필요한 스킬별로 MCP/커넥터 어댑터를 개발·검증해야 함.
4. 원격 서버 주소 및 인증 검증 후, ChatGPT 앱 설정에 등록하고 테스트.
5. 실제 동작 검증 전에는 '연결 완료'로 표시하지 않음.

## 추천 활용
- kordoc: HWPX 교수학습 과정안, 학교 행정 문서 읽기/비교.
- k-skill: kosis-stats(지리 수업 통계), korean-spell-check(안내문 검토), keris-academic-search(학술자료), k-dart(공시).

## 보안
- API 키, 개인 계정 쿠키, 학생/학부모 정보 및 교육 관련 민감 문서를 GitHub에 올리지 않습니다.
- .env, 토큰, 학교 내부 문서 원본을 커밋하지 않습니다.
- 원본 오픈소스 코드 전체를 이곳에 복제하는 대신 공식 프로젝트를 링크하여 설치/업데이트합니다.
- GitHub Pages는 정적 웹 호스팅이므로 Node 기반 MCP 서버의 실행 환경이 아닙니다.

## 상태 변경 기록
- 2026-10-12: 설치/연동 가이드 최초 등록. 라이브 MCP 배포·ChatGPT 연결·동작 검증은 별도 단계.
