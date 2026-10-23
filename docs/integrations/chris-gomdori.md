# chris.gomdori.app × ChatGPT × GitHub 연결·사용 안내

## 바로 실행하는 링크

- **[25개 원클릭 HTML 실행 허브](./gomdori-launcher.html)** — 검색·분류·외부 사이트 직접 열기·MCP 프롬프트 복사·GitHub Fork 진입 링크.
- **[노션 실행 허브](https://app.notion.com/p/3feabbdcebdc810f8b8cd9d67559a08e?pvs=204)** — 모든 프로젝트 상태 및 사용법, 실제 확인된 Fork 8개 바로가기. 현재 비공개 개인 페이지.
- HTML은 GitHub PR #1에 포함된 파일입니다. **main 병합 후 GitHub Pages 배포를 별도 확인해야 합니다**. 노션의 외부 링크는 지금 바로 사용 가능합니다.

확인: 2026-10-19. 출처: https://chris.gomdori.app/ 및 GitHub 원본 저장소 메타데이터.

## 상태 해석

- **Fork 완료** = happygeo21 GitHub에 해당 원본의 fork=true, parent가 chrisryugj 저장소로 검증된 상태.
- **ChatGPT 연결·조회 성공** = 실제 이 대화에서 해당 MCP 호출 성공.
- **직접 연결 아님** = 별도 웹앱/PC 프로그램이므로 ChatGPT 플러그인 설치와 별개. 다른 도구로 일부 대체할 수 있어도 원본 설치 완료를 의미하지 않음.
- **GitHub Fork 미확인** = 현재 GitHub 연결에서 해당 이름의 Fork가 발견되지 않음. 다른 이름의 비공개 저장소·프로젝트를 망라한다는 의미가 아님.
- 공개 코드의 Fork/재배포 가능 범위는 각 저장소의 라이선스를 따를 것. 웹사이트 자체 디자인·이미지의 재배포는 별도 확인 필요.

## 전체 22개 프로젝트 + 별도 3개 도구 (25개)

| 번호 | 항목 | 유형 | 개인 GitHub | ChatGPT 상태 | 개별 사용법 |
|---|---|---|---|---|---|
| 01 | 법령·판례 korean-law-mcp | MCP | Fork 완료 | 연결·조회 성공 | ChatGPT: ‘초·중등교육법 제○조의 현행 규정을 찾아줘’ |
| 02 | kordoc 한글 문서 | 문서 엔진 | Fork 완료 | 전용 kordoc MCP 미확인; 파일 작업 일부 가능 | HWP/HWPX를 첨부하여 변환 요청. CLI/MCP를 쓰려면 해당 저장소 README대로 별도 설치 |
| 03 | Anything (Docufinder) | Windows/macOS 앱 | Fork 완료 | ChatGPT 앱 자체 연결 아님 | PC에 공식 릴리스 설치 → 문서 폴더 색인 → 본문 키워드 검색 |
| 04 | korean-stats-mcp | MCP | Fork 완료 | 연결·조회 성공 | ChatGPT: ‘KOSIS 전라남도 시군구 주민등록인구 통계표 찾아줘’ |
| 05 | korean-patent-mcp | MCP | Fork 완료 | 연결됨·API 일일 한도 도달 | ChatGPT: ‘기후변화 특허를 찾아줘’. 서버 공유키 한도 초과 시 재시도/본인 API키 검토 |
| 06 | archhub-mcp | MCP | Fork 완료 | 연결·조회 성공 | ChatGPT: ‘화순읍 필지의 건축물대장 확인해줘’ (주소 필요) |
| 07 | schoolinfo-mcp | MCP+웹 | Fork 완료 (2026-10-19) | 연결·조회 성공 | ChatGPT: ‘화순고등학교 2026학년도 평가계획 찾아줘’; 웹 school.gomdori.app |
| 08 | korean-dart-mcp | 설치형 MCP | Fork 완료 (2026-10-19) | 이 MCP 직접 연결 확인 안 됨 | OpenDART 공시 분석은 원본 README 보고 로컬/원격 호환 구성 확인 |
| 09 | LexDiff | 웹 | Fork 완료 (2026-10-19) | 직접 연결 아님 | lexdiff.gomdori.app에서 로그인 후 법령·개정이력 비교 |
| 10 | 표준주소실록 | 웹/확장 | 개인 GitHub Fork 미확인 | 직접 연결 아님 | gjdong.vercel.app 에서 주소 목록 붙여넣고 정규화·좌표/Excel 내보내기 |
| 11 | 인파레이더 | 웹 | 개인 GitHub Fork 미확인 | 직접 연결 아님 | gjdong.vercel.app/crowd 에서 지점 선택 → 혼잡도·인쇄 보고서 |
| 12 | 광진 라이프 | 웹/PWA | 개인 GitHub Fork 미확인 | 직접 연결 아님 | gjdong.vercel.app/gwangjin에서 지역 생활정보 조회 |
| 13 | 신규자 지식창고 | 웹 | 개인 GitHub Fork 미확인 | 직접 연결 아님 | chris.gomdori.app/newbgj에서 실무 카드 찾고 법령원문 검증 |
| 14 | 복지 은하 | 웹 시각화 | 개인 GitHub Fork 미확인 | 직접 연결 아님 | chris.gomdori.app/welfare에서 제도 노드 탐색 |
| 15 | 제도 은하 | 웹 시각화 | 개인 GitHub Fork 미확인 | 직접 연결 아님 | chris.gomdori.app/korea100에서 제도·조문 관계 탐색 |
| 16 | 학습 은하 | 웹 시각화 | 개인 GitHub Fork 미확인 | 직접 연결 아님 | chris.gomdori.app/learnmap에서 중·고 성취기준 연계 탐색 |
| 17 | 정부 은하 | 웹 시각화 | 개인 GitHub Fork 미확인 | 직접 연결 아님 | chris.gomdori.app/onegov에서 부처별 문서 관계 탐색 |
| 18 | fable-ish | Claude Code 플러그인 | Fork 완료 (2026-10-19) | ChatGPT 일반 채팅에 직접 적용 불가 | Claude Code 저장소에 원본 지침에 따라 설치하여 코드 검증 게이트 적용 |
| 19 | hermes-dashboard | Hermes Agent 도구 | Fork 완료 (2026-10-19) | ChatGPT 일반 채팅에 직접 적용 불가 | Hermes Agent 사용 시 원본 README에 따라 서버·대시보드 설정 |
| 20 | ollama-mcp-host | 로컬 호스트 | Fork 완료 (2026-10-19) | ChatGPT 일반 채팅에 직접 적용 불가 | Node 20+·Ollama 설치 후 로컬 MCP 호스트 구성 |
| 21 | edoc-summarizer | 브라우저 확장 | Fork 완료 (2026-10-19) | ChatGPT 일반 채팅에 직접 적용 불가 | Edge/Chrome 확장 설치 후 지원 전자문서 페이지에서 요약 실행 |
| 22 | fde-wizard | Blender 예제/웹 | Fork 완료 (2026-10-19) | ChatGPT 일반 채팅에 직접 적용 불가 | chris.gomdori.app/wizard 체험, 커스텀 3D 작업은 Blender Python 필요 |
| +1 | 점심 딸깍 | 웹 | 별도 Fork 미확인 | ChatGPT 연결 불필요 | chris.gomdori.app/lunch에서 위치 허용 후 무작위 점심 장소 확인 |
| +2 | 교대근무 딸깍 | 웹 | 별도 Fork 미확인 | ChatGPT 연결 불필요 | chris.gomdori.app/shift에서 이름·근무지 입력 후 자동 배정/엑셀 추출 |
| +3 | 당직 딸깍 | 웹 | 별도 Fork 미확인 | ChatGPT 연결 불필요 | chris.gomdori.app/duty에서 명단·월 입력 후 캘린더 생성 |

## 이미 완료된 GitHub Fork의 검증 원본

- https://github.com/happygeo21/korean-law-mcp → chrisryugj/korean-law-mcp
- https://github.com/happygeo21/kordoc → chrisryugj/kordoc
- https://github.com/happygeo21/Docufinder → chrisryugj/Docufinder (Anything)
- https://github.com/happygeo21/korean-stats-mcp → chrisryugj/korean-stats-mcp
- https://github.com/happygeo21/korean-patent-mcp → chrisryugj/korean-patent-mcp
- https://github.com/happygeo21/archhub-mcp → chrisryugj/archhub-mcp

## 5개 원격 MCP 실제 테스트

| 도구 | 테스트 입력 | 실행 결과 |
|---|---|---|
| 법령 | 초중등교육법 | 성공 — 법령 및 시행령 검색 |
| KOSIS | 전라남도 인구 | 성공 — 주민등록인구 통계표 검색 |
| 학교정보 | 화순고등학교 | 성공 — 학교 검색 |
| 건축HUB | 전남 화순군 화순읍 | 성공 — 지역코드 검색 |
| 특허 | 기후변화 | 연결·도구 호출 가능 / 실제 조회는 공유 API RATE_LIMITED |

## 연결을 추가할 때의 원칙

1. 웹앱은 대체로 브라우저에서 링크만 열면 됨. ChatGPT 플러그인 자동 생성 불가.
2. 원격 MCP가 있는 경우 ChatGPT 설정의 플러그인 연결을 사용자 본인이 승인해야 함. 관련 채팅·메모리가 외부 운영자에게 전달될 수 있는 범위를 먼저 확인.
3. 로컬 프로그램/kordoc CLI/Claude Code 확장/브라우저 확장은 각 PC에 따로 설치. GitHub Fork 자체는 설치나 서비스 실행이 아님.
4. 개인 학생정보, 주민등록번호, 로그인 쿠키, 인증 API 키를 이 저장소에 업로드하지 말 것.
5. 학교업무 및 연구에 공공 데이터 이용 시 기준일·공식 출처·신뢰도를 검증할 것.

## K-Skill 통합

별도 프로젝트 https://k-skill.nomadamas.org/ 은 Claude Code·Codex 등 로컬 에이전트용 스킬 집합입니다. 항목별 설치/사용법 표는 [K-Skill 문서](../k-skill/README.md)를 참조하세요. **현재 로컬 Codex 설치 여부는 이 대화로 확인 불가**입니다.

## 공식 안내

- https://chris.gomdori.app/
- https://github.com/NomaDamas/k-skill


## 2026-10-19 GitHub Fork 재검증

추가 8개 저장소의 `fork=true` 및 `parent=chrisryugj/...` 관계를 확인했습니다. **로컬 설치 또는 ChatGPT 연결 완료는 아닙니다.** 세부 반영 시각은 이 문서의 GitHub Commit을 기준으로 합니다.
