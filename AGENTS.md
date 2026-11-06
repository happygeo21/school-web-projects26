# Project operating instructions — GitHub ↔ Notion

Applies to work on this repository. Keep these rules consistent with [Notion operations](docs/operations/notion-sync.md).

## Canonical destinations
- Single Notion management hub: https://app.notion.com/p/3f1abbdcebdc8137adddf8d80317fcc4
- Project / tool registry: https://app.notion.com/p/a93abb488bd343c68d6756cd950ff8f1
- Change / deployment log: https://app.notion.com/p/92022425cbfa4549ab30d6589a0206fe
- Existing external tools catalog (reference only): https://app.notion.com/p/3feabbdcebdc810f8b8cd9d67559a08e
- Old GitHub scrap (reference only): https://app.notion.com/p/3fbabbdcebdc812f90c5e3922ca905a1

## Mandatory end-of-work checklist
For **every GitHub-related task** (create, modify, review, fork, deploy, install guide, security remediation):
1. Inspect the original branch, existing files, and safety/privacy impacts before edits.
2. Make only the requested changes; avoid publishing student personal information or keys.
3. Record the full commit SHA and actual timestamp in Asia/Seoul, or clearly mark PR/Draft/uncommitted.
4. Check Pages/Netlify and app behavior **independently**. A successful commit is not sufficient proof of a working deployment.
5. If an authorized Notion connector is available, update the existing project registry entry (do not make duplicates) and append **one change-log entry per completed task**, including commit, deployment result, KST time, next action, and Notion status.
6. Read back the Notion entry after writing. Mark 'Notion 반영=완료' ONLY when the write is confirmed. If unavailable, mark **미완료**, give the reason and the exact text the user can add; do not invent success.
7. End each user-facing GitHub work report with:
   `GitHub: ✅ 완료 / ⏳ 검토 중 / ❌ 미완료 | 배포: ✅ 성공 확인 / ⚠️ 미확인 / ➖ 해당 없음 | Notion: ✅ 반영 완료 / ⚠️ 미반영(사유) / ➖ 해당 없음`.
8. When only GitHub was updated and Notion cannot be accessed, say **Notion: ⚠️ 미반영**; never claim automatic integration was installed.

This repository file guides agents that load AGENTS.md. It does **not** grant Notion access or install a GitHub↔Notion auto-sync service.

## Preservation
- Preserve existing Firebase root and student records; never weaken Realtime Database Rules.
- Keep GitHub Pages links stable by retaining the canonical `index.html` and subpath names.
- No silent merge of draft PRs or force pushes.
- Never place GitHub/Netlify/Notion tokens in tracked files, page descriptions, logs, or client HTML.

Updated: 2026-10-19 (Asia/Seoul).

## Image creation and teaching visuals
- For exploratory image generation requests, consult [image-style-library/README.md](image-style-library/README.md) and suggest 3–4 appropriate, distinct visual styles with one recommended option, unless the user specifies a style or asks for immediate generation.
- The 100 slash-keywords are style labels, not native ChatGPT commands. Prompt details, not the labels alone, produce images. The original full prompts and illustrations are on the [JJ Creative reference site](https://www.jjcreative.co.kr/lounge/imgcode).
- The standalone [image-style-library/](image-style-library/) contains the searchable catalog, scoped AGENTS.md, and Notion reference. For geography lessons, verify substantive spatial/statistical facts.

## Happy GEO common production standard (2026-11-06)
- Follow [docs/HAPPY_GEO_COMMON_GUIDELINES.md](docs/HAPPY_GEO_COMMON_GUIDELINES.md) for all new HTML and substantive revisions, as well as project status, quality checks, and reporting.
- Preserve the more restrictive repository and project-specific safety rules above. This is documentation only; no deployment or automatic integration is implied.


## Happy GEO 자연어 작업 라우팅 · Notion Skill (2026-11-06)
- 관련 자연어 요청이 오면 먼저 [Happy GEO 공통 지침](docs/HAPPY_GEO_COMMON_GUIDELINES.md)과 기존 코드/PR/실행 상태를 대조한다. 예: "편집되는 HTML", "지리 수업 웹앱", "Apps Script", "수행평가", "지리 그래프", "AI 사무실".
- Notion 연결 및 조회 권한이 있다면 매 작업 시작 시 **사용자가 활성화한 Notion Skill 목록**을 조회하고, 관련 Skill을 실제로 읽어 적용한다. 기본 Skill: [Happy GEO 자연어 실행 지침](https://app.notion.com/p/410abbdcebdc81fab15cf60560cd4462). Notion 도구가 없으면 저장소 지침으로 작업하고 Notion 자동 연결을 주장하지 않는다.
- 데이터·이미지·라이브러리 선택, 편집형 HTML·재저장·PDF·검수·개인정보 분리는 상세 지침을 따른다. 이미 확인된 시스템(Firebase, Notion, Telegram/Worker, Google Sheets)과 중복 프로젝트를 만들지 않는다.
- **문서 저장 ≠ 자동 실행/운영 반영.** 승인되지 않은 PR 병합·배포·권한/개인정보 변경은 하지 않는다.
