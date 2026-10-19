# OpenSlide Windows PowerShell installer (requires user's confirmation)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js LTS required: https://nodejs.org/' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm not found' }
Write-Host ('Node '+(node --version)+' / npm '+(npm --version))
if (Test-Path './my-deck') { throw 'my-deck exists. Use an empty directory to protect existing files.' }
$ok=Read-Host 'Run npx @open-slide/cli init my-deck ? Type yes to continue'
if ($ok -ne 'yes') { Write-Host 'Cancelled'; exit 0 }
npx @open-slide/cli init my-deck
Set-Location my-deck
Write-Host 'Review package.json and AGENTS.md, then run npm run dev'
