@echo off
title Sharing Excess - Backend :8003
cd /d "%~dp0backend"
REM --timeout-graceful-shutdown: live-update streams stay open for hours, so auto-reload must not wait for them
if exist ".venv\Scripts\uvicorn.exe" (
    ".venv\Scripts\uvicorn.exe" app.main:app --host 127.0.0.1 --port 8003 --reload --timeout-graceful-shutdown 3
) else (
    uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload --timeout-graceful-shutdown 3
)
pause
