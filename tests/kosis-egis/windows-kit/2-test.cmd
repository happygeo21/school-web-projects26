@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 22+ from nodejs.org first. & pause & exit /b 2)
node run-all-tests.cjs
set "QA_EXIT=%ERRORLEVEL%"
echo Exit code: %QA_EXIT%
pause
exit /b %QA_EXIT%
