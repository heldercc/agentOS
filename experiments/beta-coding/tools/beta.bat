@echo off
rem AgentOS Beta Coding — one double-click launcher (ADR-0012 / ADR-0013).
rem [1] Dashboard: local browser UI — run, watch, judge blind, see results.
rem     The dashboard hosts the manual-model worker itself (no separate watcher).
rem [2]/[3] Console fallbacks; [4] aggregate an existing judged run.

setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"

echo ==================================================
echo   AgentOS Beta Coding  --  experiment launcher
echo ==================================================
echo   [1] Dashboard no browser  (recomendado -- correr, julgar, resultados)
echo   [2] Consola: modelo fake   (instantaneo, custo zero)
echo   [3] Consola: modelo manual (spawn Claude Codes -- subscricao, sem API)
echo   [4] Resultados de uma corrida ja julgada
echo.
set "CHOICE="
set /p "CHOICE=Escolhe 1 / 2 / 3 / 4: "

if "%CHOICE%"=="4" goto results_only
if "%CHOICE%"=="3" (set "MODEL=manual") else if "%CHOICE%"=="2" (set "MODEL=fake") else goto dashboard

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "RUN=%MODEL%-%%i"

if "%MODEL%"=="manual" (
  echo.
  echo A iniciar o watcher da mailbox numa nova janela...
  start "AgentOS spawn watcher" cmd /k "%~dp0spawn.bat"
  timeout /t 1 /nobreak >nul
)

echo.
echo A correr o conductor para a corrida "%RUN%"...
call npx tsx src/cli/conduct.ts --run "%RUN%" --model "%MODEL%"
if errorlevel 1 (echo. & echo O conductor falhou. & pause & exit /b 1)

echo.
echo A abrir a folha cega e os veredictos para julgar...
start "" notepad "runs\%RUN%\eval\sheet.md"
start "" notepad "runs\%RUN%\eval\verdicts.json"
echo.
echo Julga cada tarefa em sheet.md, preenche verdicts.json (A / B / tie), GRAVA, e
pause

call npx tsx src/cli/results.ts --run "%RUN%"
if errorlevel 1 (echo. & echo Os resultados falharam. & pause & exit /b 1)
start "" notepad "runs\%RUN%\RESULTS.md"
echo.
echo Feito.  Resultados: runs\%RUN%\RESULTS.md
pause
exit /b 0

:dashboard
echo.
echo A iniciar o dashboard em http://localhost:4600 ...
echo (fecha esta janela para parar o servidor)
start "" "http://localhost:4600"
call npx tsx src/cli/dashboard.ts
pause
exit /b 0

:results_only
set "RUN="
set /p "RUN=Id da corrida: "
call npx tsx src/cli/results.ts --run "%RUN%"
start "" notepad "runs\%RUN%\RESULTS.md"
pause
exit /b 0
