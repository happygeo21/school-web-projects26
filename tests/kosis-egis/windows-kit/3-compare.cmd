@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 22+ from nodejs.org first. & if not defined EGIS_QA_NONINTERACTIVE pause & exit /b 2)
if "%~3"=="" (echo Usage: 3-compare.cmd original.xlsx converted.csv config.json output-folder & if not defined EGIS_QA_NONINTERACTIVE pause & exit /b 2)
set "QA_OUT=%~4"
if "%QA_OUT%"=="" set "QA_OUT=excel-comparison"
node compare-excel.cjs "%~1" "%~2" "%~3" "%QA_OUT%"
set "QA_EXIT=%ERRORLEVEL%"
echo Exit code: %QA_EXIT%
if not defined EGIS_QA_NONINTERACTIVE pause
exit /b %QA_EXIT%
