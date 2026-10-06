@echo off
title Sharing Excess - Backend :8003
cd /d "%~dp0backend"
if exist ".venv\Scripts\uvicorn.exe" (
    ".venv\Scripts\uvicorn.exe" app.main:app --host 127.0.0.1 --port 8003 --reload
) else (
    uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
)
pause
