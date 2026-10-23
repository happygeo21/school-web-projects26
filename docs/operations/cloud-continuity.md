# Cross-device cloud continuity — ChatGPT Work / Codex / GitHub

Updated: 2026-10-23 (Asia/Seoul). This is an operational guide, **not** an automatic sync service or a change to deployment settings.

## Canonical system of record
- Code and reviews: GitHub `happygeo21/school-web-projects26`, default branch `main`.
- Work decisions and next actions: [Project handoff](../PROJECT_HANDOFF.md). Update it on any meaningful handoff, without personal data.
- Projects and deployment status: [Notion tool hub](https://app.notion.com/p/3f1abbdcebdc8137adddf8d80317fcc4), [registry](https://app.notion.com/p/a93abb488bd343c68d6756cd950ff8f1), [change log](https://app.notion.com/p/92022425cbfa4549ab30d6589a0206fe).
- Browser, desktop, and mobile can read cloud Work conversations; Codex conversations remain separate from ChatGPT chats. Treat source code and handoff documents—not conversation history—as the durable cross-tool interface.

## New tasks: recommended setup
1. In ChatGPT web/mobile, start **Work (cloud)** using the relevant ChatGPT Project and authorized GitHub/Notion sources.
2. In Codex, choose **Codex Cloud**, configure an environment for this repository, verify GitHub access, and **publish** it. Use a new cloud task; an old local Codex conversation is not converted into a ChatGPT conversation. Confirm that a repository is explicitly included in the environment.
3. At task start, read `AGENTS.md`, this guide and `docs/PROJECT_HANDOFF.md`. Verify the latest `main` commit. Work on a feature branch, then open a PR. Do not infer that local/uncommitted changes are in GitHub.
4. At task end, update the handoff and record commit SHA, PR, review/test results, deploy verification (separate), and next action in existing Notion registry/change log. Re-fetch after a Notion write.
5. The desktop Work **local work sync**, if enabled for the account/workspace, applies only to **new** tasks. It does not migrate old local Work tasks, and does not merge Codex history into ChatGPT. Local files require the computer to remain online while accessed.

## Safety and publication
- Never copy student personal information, grades, counselling, authentication tokens, or wedding private records into this public repository or public task notes.
- Never move a private repository or its contents into public GitHub Pages, Netlify, Cloudflare, or a shared Notion page just for synchronization.
- Browser workspaces, connected repository access, Cloud Work, and Codex Cloud have independent authorizations; a linked GitHub account does not automatically grant every Codex environment access.
- Never auto-merge, force-push, or treat successful commits as verified deployments. Changes to Firebase / Firestore data need separate authenticated backup, consent, and validation.
- Existing local unsaved changes require explicit diff review and commit; existing cloud task uncommitted state may not persist indefinitely.

## Verification checklist
- [ ] Current GitHub commit SHA matches Codex cloud task base
- [ ] Cloud Codex environment published and the selected repository is accessible
- [ ] Cloud Work task opened on web, then re-opened on desktop/mobile
- [ ] Handoff and Notion registry/change log updated without duplication
- [ ] Deployment/browser functionality independently checked where relevant
- [ ] No private/student information crossed a publication boundary

Official documentation:
- https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- https://help.openai.com/en/articles/20001548-agent-security-and-local-work-sync-in-chatgpt
- https://help.openai.com/ko-kr/articles/20001545-using-codex-cloud
