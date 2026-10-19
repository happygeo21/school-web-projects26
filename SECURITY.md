# Repository security and student data policy

This repository contains **public static educational websites**. Assume any content committed here, including old Git history and deployed HTML/JavaScript, can be accessed by anyone.

## Never commit
- Student names paired with identifiers, detailed student evaluations/grades, home addresses, parent details, medical or attendance records, unapproved student submissions.
- Passwords, Firebase admin/service-account JSON, GitHub/Netlify/PAT credentials, API provider secret keys, session tokens, private keys or .env files.
- Full Firebase Realtime Database snapshots or raw class CSV exports.

Use `.gitignore` only to prevent *future accidental commits*. Ignoring or deleting a previously committed secret does **not** revoke that secret or erase Git history.

## Firebase special notes
- Client Firebase `apiKey`, `projectId`, `databaseURL` are **public project configuration**, not equivalent to a service-account private key. Do not rely on their secrecy.
- Keep Realtime Database Rules restricted by authenticated user UID and explicitly approved teacher privileges.
- For `memoryTemperature2026/submissions`, only approved teachers should list everyone's submissions; students should be allowed to write only their own UID path. Public map should read only `published`.
- For `energyMatchV10_3`, do not use unconditional read/write permissions. The [security guide](./happygeo/FIREBASE_SECURITY_GUIDE.md) is an example, not evidence that live rules are deployed.
- Confirm in **Firebase Console → Realtime Database → Rules** using the Rules Playground or Emulator Suite. The actual rules were **not verified by this GitHub audit**.
- Ensure public submissions exclude unnecessary personal details and are approved before public-map display.

## Account and Actions
1. Enable GitHub 2FA/passkey and inspect active sessions, SSH keys, GitHub Apps, fine-grained tokens.
2. Enable available secret scanning, push protection, Dependabot alerts, and review default-branch protection/settings.
3. Store any Netlify deploy token only in GitHub Actions Secrets, and use least privileges; never add it to HTML or Notion.
4. Ensure Netlify uses the intended publish directory and that build logs do not echo credentials.
5. Check Git commit author email privacy. Prior commit metadata may reveal the commit author email even if profile visibility is off. Configure a GitHub `noreply` commit identity for future commits.

## Incident response
If a real secret was ever committed: revoke/rotate it at the provider **first**, review access logs and permissions, remove it from current code, and plan Git history cleanup only after impact assessment. Rewriting history may break existing forks/deployments, so do not do it casually.

## Scope & dates
- Review date: 2026-10-19 (KST)
- Examined: accessible public GitHub repository metadata, selected frontend code, workflow configuration, and tracked path names for 15 repositories.
- Not verified: historical commits in full, GitHub org/account security settings, Firebase live rules, Netlify project configuration, Netlify secrets, private files on the user's devices.
- GitHub security guidance is **not** a certification of breach absence.
