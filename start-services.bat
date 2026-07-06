@echo off
title Sharing Excess Launcher
cls

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo    Sharing Excess ^| Starting All Services
echo  ============================================================
echo.

REM ── Check if ports are already occupied ─────────────────────────────────────
for %%P in (8003 5175) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P is already in use.
        echo      Run stop-services.bat first, then try again.
        echo.
        pause
        exit /b 1
    )
)

echo  [1/2] Starting Backend API   ^| port 8003
start "Sharing Excess - Backend :8003" "%ROOT%_run_backend.bat"

echo.
echo  Waiting 5 seconds for backend to initialise...
timeout /t 5 /nobreak >nul

echo  [2/2] Starting Frontend      ^| port 5175
start "Sharing Excess - Frontend :5175" "%ROOT%_run_frontend.bat"

echo.
echo  ============================================================
echo    All services launched in separate windows.
echo.
echo    Backend API  :  http://localhost:8003
echo    Frontend     :  http://localhost:5175
echo    API Docs     :  http://localhost:8003/docs
echo.
echo    Run stop-services.bat to shut everything down.
echo  ============================================================
echo.
pause
