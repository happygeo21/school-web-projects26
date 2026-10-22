# Security review — 2026-10-22 KST

This change is prepared on a review branch. It has not changed the production Pages deployment, Firebase Rules, API keys, or Cloudflare Worker.

## Proposed changes

- Remove fixed personal plans and budget defaults from the public wedding guide. Dates, attendance and prices become user inputs. Keep existing local backup format and storage key; no existing user data is deleted.
- Build Pages from `scripts/public-files.json` into `_site`, rather than uploading the repository root. Only 71 reviewed public files are included. Backend source, rules, internal documents, tests and dependency manifests are excluded.
- Keep education project files and routes unchanged. Three help documents linked from public pages remain explicitly allowed.
- Grant Pages/OIDC write permissions only to the deployment job. The build job receives repository read permission.

## Validation

- Exact pre-change wedding source snapshot was verified in a private archive before editing.
- The staging build contains 71 files; education files are byte-identical to their source.
- Public wedding HTML contains no fixed personal plan markers checked by the build.
- Existing 22 tool/Worker/payload tests pass. These mocked tests do not prove two-user production behavior.
- Browser test: user-entered attendance and meal price calculate the expected total.
- Live unauthenticated Firestore reads were denied; attachment endpoints denied requests without authentication.
- Education Pages and both existing Netlify sites rendered during this review. New Netlify production deployments are paused by the team's existing credit limit.

## Remaining decisions

- Review and approve this PR before production deployment. Monitor Pages after merge and smoke-test all current public routes.
- Personal content can remain in old Git commits and prior deployment artifacts. Current-file cleanup does not erase history or caches. Any destructive cleanup requires a separate plan and approval.
- GitHub 2FA requires account-owner enrollment. Review installed apps that have access to all current and future repositories.
- Firebase web configuration is not a data authorization boundary. Keep server-side verified Google membership and private allowlists; check production API restrictions before changing a live key.
- Complete actual approved/unapproved-account record, attachment and Notion tests. The Google account chooser stalled during this session; no production test record was written.
- No production data was deleted, no history was rewritten, and no credential was revoked.

## Recovery and operation

Keep the private source snapshot and local verified Git mirrors outside public hosting. If deployment fails, investigate the failed build before publishing. Do not blindly revert the privacy cleanup, since doing so would republish personal plans. Restore only required non-sensitive public assets from the recorded baseline.

Add new web assets explicitly to the public manifest. Store actual personal/student records only in authorized data stores. Never add private backups, service accounts or tokens to this repository or its deployment artifact.
