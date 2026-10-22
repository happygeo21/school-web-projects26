# Wedding planner server access boundary

The wedding-planner Pages path is a login entry point. Its three HTML files contain no planner content or Notion links. Runtime source and tests are maintained in the existing private archive. All private HTML, scripts, styles and tool files are served only after the server verifies a Firebase ID token through production Firestore Rules and the existing two-member allowlist.

No paid service, service-account key, new member or database migration is introduced. The existing Notion export and attachment gateway remains in place. Local browser storage from the previous origin is retained but is not copied automatically to the new origin. Shared Firestore and Notion records are preserved.

This change removes the runtime from the current public deployment and current source. Historical commits, old artifacts, previously published Notion pages and cached copies require their own cleanup and verification. Do not label the whole account or all past data as private merely because this entry point redirects to login.

Anonymous direct URLs and forged/expired tokens are tested separately from Google login, approved-user read/write/attachments, Notion permissions and education-site behavior. Report incomplete checks explicitly.
