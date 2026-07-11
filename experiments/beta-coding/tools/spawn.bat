@echo off
rem AgentOS Beta Coding — mailbox watcher (ADR-0013).
rem Watches mailbox/outbox for prompt files and, for each, spawns a Claude Code
rem (your subscription, NOT the metered API wallet) to produce the answer, which
rem it writes into mailbox/inbox. The experiment engine collects the answers.
rem
rem Worker command: defaults to Claude Code print mode reading the prompt on stdin.
rem If your CLI differs, set WORKER_CMD before launching, e.g.:
rem   set "WORKER_CMD=claude -p --permission-mode plan"

setlocal enabledelayedexpansion
cd /d "%~dp0.."
if not defined WORKER_CMD set "WORKER_CMD=claude -p"
set "OUT=mailbox\outbox"
set "IN=mailbox\inbox"
if not exist "%OUT%" mkdir "%OUT%"
if not exist "%IN%" mkdir "%IN%"

echo [beta watcher] worker: %WORKER_CMD%
echo [beta watcher] watching %OUT%  (close this window or Ctrl-C to stop)
echo.

:loop
for %%F in ("%OUT%\*.md") do (
  if not exist "%IN%\%%~nxF" (
    echo   working: %%~nxF
    type "%%F" | %WORKER_CMD% > "%IN%\%%~nxF.part"
    move /y "%IN%\%%~nxF.part" "%IN%\%%~nxF" >nul
    echo   done:    %%~nxF
  )
)
timeout /t 2 /nobreak >nul
goto loop
