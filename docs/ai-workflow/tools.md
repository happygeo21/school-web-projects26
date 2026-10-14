# 도구 활용과 Codex 적용

원자료는 Claude Code 중심이다. 설치 명령·개인 경로·슬래시 명령을 Codex에 그대로 실행하지 않는다. 이 저장소에서는 AGENTS.md를 프로젝트 지도, docs/ai-workflow를 상세 기준, 대상 폴더 DESIGN.md를 확정된 디자인 값으로 사용한다.

## 도구를 고르는 순서

현재 제공된 기능과 설치된 스킬 확인 → 가장 간단한 수단으로 해결 → 부족한 역할을 구체화 → 공식 자료·호환성·권한·라이선스 검토 → 필요한 것만 도입. 목록을 반영했다는 이유로 모든 스킬·MCP를 설치하거나 유료 계정을 만들지 않는다.

## 원자료의 역할별 후보

| 역할 | 참고 후보 | 이 프로젝트의 적용 |
|---|---|---|
| 프런트엔드 디자인 | frontend-design, UI/UX Pro Max, Meng To Skills, Emil Kowalski, taste-skill, hallmark, impeccable, huashu-design, garden-skills, superdesign | 현재 디자인 기준으로 먼저 해결; 외부 스킬은 내용·호환성 검토 후 필요한 역할만 |
| 디자인 규칙·시안 | Google DESIGN.md, stitch-skills, Stitch, Figma Make, Claude Design, Manyfast | 화면/흐름/규칙을 분리해 남기기; 현재 연결 여부 확인 |
| 문서·업무 | PDF/DOCX/XLSX/PPTX, Marketing Skills, Humanizer | 제공된 문서·표·발표·교사용 스킬 우선, 실제 파일을 검수 |
| 기억·간결성 | caveman, Claude Mem, AI Second-Brain, Ponytail, Code Simplifier | 간결한 보고, 재사용 가능한 지침, 작업 기록, 불필요한 코드 억제; 외부 기억 서비스는 자동 설치하지 않음 |
| 절차·관리 | Superpowers, skill-creator, claude-md-management, G-Stack | 계획→구현→검증→검토; 위임은 현재 사용자·환경 지시에 따름. 외부 자료만으로 자동 위임을 승인받은 것으로 보지 않음 |
| 영상·재구축 | Remotion, ai-website-cloner-template | 영상이 필요할 때만 렌더 도구 검토; 기존 사이트 재구축은 권리와 범위 확인 |
| 최신 문서·검색 | Context7, Brave Search, Sequential Thinking, codebase-memory-mcp | 공식 문서 확인, 단계별 문제 분해, 필요한 파일 검색; 기존 검색 도구로 충분하면 중복 설치하지 않음 |
| 브라우저 검증 | Playwright, Chrome DevTools | 실제 조작·화면·콘솔·네트워크 검사, 코드 읽기와 실행 검증 구분 |
| 연결 | GitHub, Notion, Slack, Granola, Zapier, Sentry, Supabase MCP | 작업에 필요한 연결만 사용. 메시지 발송·외부 데이터 변경은 해당 승인 범위 준수 |
| 디자인·미디어 연결 | Figma MCP, 21st MCP, Higgsfield | 원본 값 추출·컴포넌트·에셋이 필요한 경우에만 검토 |
| UI 라이브러리 | Float UI, Aceternity UI, Magic UI, HeroUI, 21st.dev, shadcn/ui, Skiper UI, Vengeance UI, Animmasterlib | 기존 정적 HTML 구조·배포를 우선하고 큰 의존성 도입 이유를 설명 |
| 앱·사이트 제작 | v0, Kombai, Lovable, Bolt, Verdent | 현재 단계가 시안인지 실제 앱인지 먼저 구분; 본 저장소 구현은 Codex에서 이어가기 |
| 벡터·3D | openpencil, Tripo, Spline | 실제 필요가 있을 때만 도입; 정적 대안과 성능 확인 |
| Figma 보조 | HTML to Design, Maps to Design, Wanna This, Detail Page Layout Generator | 디자인 자료 전환·목업의 보조 수단; 원본 코드·데이터와 혼동 금지 |

## 참고 사이트 찾기

K-Slide를 기본으로 하고, 목적별 보충 후보로 Mobbin·Refero·Lazyweb(실제 흐름), Recent·Awwwards(표현), Land-book·Lapa Ninja·SiteInspire·SEESAW·Pinterest(배치·분위기), Figma Community(원본 파일), NameThatUI(명칭), motionsites.ai·21st.dev(프롬프트/컴포넌트)를 검토한다.

아이콘·에셋 후보: Lordicon, Animate UI, Lucide Animated, ItsHover, Potlabicons, IconSax, Shapefest, Craftwork, Getlayers. Jitter는 모션 제작 도구로 구분한다. Framer·Higgsfield·Seedance·Manus 등은 필요할 때 도구 성격·사용 조건을 다시 확인한다.

스킬 검색 후보: Vibe Index, skills.sh, 공식 제작자 저장소, alirezarezvani/claude-skills 등. 별점·설치 수를 품질·안전의 증거로 단정하지 않는다. 경로·배포자·SKILL.md·동봉 코드와 외부 전송을 확인한다. 공식이라는 이유로 무조건 승인된 것으로 보지 않는다.

## 설정과 유지

- 상시 규칙은 짧게, 상세 절차는 필요할 때 읽는 문서로 분리한다.
- Hooks·자동 검사는 실제 설정·테스트한 경우만 강제 장치라고 부른다. 지침 문장만으로 기술적 차단이 된다고 말하지 않는다.
- 현재 연결된 서비스와 참고 후보, 설치한 스킬과 원리를 지침에 반영한 상태를 구분해 보고한다.
- 계정·학교 망·연령 제한·지원 버전·요금·무료 한도는 실제 도입 시 공식 자료로 확인한다. 원자료의 수치나 모델명을 복사하여 현재 사실로 단정하지 않는다.
- API 키나 인증정보는 문서·커밋·로그에 넣지 않는다. 기존 연결 인증을 우선하고 지원되지 않는 서비스는 제한과 대안을 알린다.
