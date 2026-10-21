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
