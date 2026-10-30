# Windows native validation

PowerShell 7, Node.js 22+, JDK 21+, Python 3.9+ and the existing `npm ci` dependencies are sufficient. WSL is not required. No installer, global PATH change, TLS override, firewall change, publish or deployment command is included.

`Run-Windows-Validation.ps1` has four explicit modes:

| Mode | Inputs | Effect |
|---|---|---|
| `PersonalRules` | `-PrivatePackage`, `-ExpectedRulesSHA256` | Exact external package only; `demo-veteransgeo` Database Emulator |
| `Probe` | `-Config`, `-Report` | Two read-only target checks; always passes `--probe-only` |
| `Protocol` | `-Config`, `-Report` | Existing real-service protocol; synthetic data in approved test projects |
| `Serve` | `-Prepared` | Existing prepared test-web only, on loopback |

Use full executable paths with `-NodeExe` / `-PythonExe`, and a portable JDK with `-JavaHome`, if tools are not on PATH. These affect only the current process. `VETERANSGEO_POWERSHELL` can point to an existing PowerShell 7 executable. `-UseSystemCA` opts into Node's supported system trust store flag; it never disables certificate checks or imports certificates. A missing flag or failed ACL check stops execution.

Personal Rules stay outside Git. The Python runner checks the package manifest, all original file hashes, the separately supplied Rules SHA256 and the approved role binding. It loads `prepared-1/test-only.rules.json` directly in both CLI configuration and the unchanged private Node tests; it never substitutes the repository Rules. Only sanitized TAP totals and permitted case names are retained. Raw CLI/database logs are discarded in memory. A port already in use stops the run. No tests run means `success=false` and null counts.

Windows config permissions use a real DACL check, rather than POSIX mode bits. Only the current identity, SYSTEM and Administrators are accepted, plus inherited read-only Codex sandbox access. Broader principals fail closed. The ACL is inspected, never changed on a real private file.

The Windows HTTP path uses native HTTPS memory buffers instead of `mkfifo`. It preserves binary bodies, refuses redirects and uses normal TLS validation. Linux retains its existing curl/FIFO transport. npm Emulator orchestration uses Node subprocesses for both Rules modes, avoiding shell-specific environment assignments.

## Evidence boundaries

[Sanitized Windows live result](validation/windows-live-20261030.json) records the completed local run against the earlier PR source commit with private adapters. It omits project settings, account identifiers, activity codes, original Rules, personal Rules hashes, private filesystem paths and raw responses. The original protocol run was interrupted; state readback and continuation completed the listed media/browser checks. It is not an uninterrupted full-suite claim.

The generalized PR implementation is separately covered by native TLS/DACL tests, external-package Emulator verification and read-only live probe regression. CI uses only synthetic repository fixtures and demo Emulators; it has no private package or live credentials. Generated localhost TLS certificates are temporary files and are never imported into an OS trust store.

Both CI jobs build `_site`, verify all 99 allowlisted public files and test the existing repository subpaths for student, teacher and public pages. Byte comparisons use a binary response to avoid local HTML-filter injection; browser behavior still uses normal HTML. Security code, this report and private paths must return 404 from the Pages artifact. No Pages deployment workflow is run by these tests.
