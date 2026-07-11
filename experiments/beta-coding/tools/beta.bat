@echo off
rem AgentOS Beta Coding — one double-click launcher (ADR-0012 / ADR-0013).
rem Runs a full comparison, opens the blind sheet for judging, then the results.
rem The manual model spawns Claude Codes on your subscription (no API wallet).

setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "PATH=%ProgramFiles%\nodejs;%PATH%"

echo ==================================================
echo   AgentOS Beta Coding  --  experiment launcher
echo ==================================================
echo   [1] Fake model   (instant, free, sanity check)
echo   [2] Manual       (spawn Claude Codes -- your subscription, no API wallet)
echo   [3] Results only (aggregate an existing run after you have judged it)
echo.
set "CHOICE="
set /p "CHOICE=Choose 1 / 2 / 3: "

if "%CHOICE%"=="3" goto results_only
if "%CHOICE%"=="2" (set "MODEL=manual") else (set "MODEL=fake")

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "RUN=%MODEL%-%%i"

if "%MODEL%"=="manual" (
  echo.
  echo Starting the spawn watcher in a new window...
  start "AgentOS spawn watcher" cmd /k "%~dp0spawn.bat"
  timeout /t 1 /nobreak >nul
)

echo.
echo Running the conductor for run "%RUN%"...
call npx tsx src/cli/conduct.ts --run "%RUN%" --model "%MODEL%"
if errorlevel 1 (echo. & echo Conductor failed. & pause & exit /b 1)

echo.
echo Opening the blind sheet and verdicts for judging...
start "" notepad "runs\%RUN%\eval\sheet.md"
start "" notepad "runs\%RUN%\eval\verdicts.json"
echo.
echo Judge each task in sheet.md, fill verdicts.json (A / B / tie), SAVE it, then
pause

call npx tsx src/cli/results.ts --run "%RUN%"
if errorlevel 1 (echo. & echo Results failed. & pause & exit /b 1)
start "" notepad "runs\%RUN%\RESULTS.md"
echo.
echo Done.  Results: runs\%RUN%\RESULTS.md
pause
exit /b 0

:results_only
set "RUN="
set /p "RUN=Enter the run id: "
call npx tsx src/cli/results.ts --run "%RUN%"
start "" notepad "runs\%RUN%\RESULTS.md"
pause
exit /b 0
