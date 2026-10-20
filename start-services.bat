@echo off
setlocal
title Sharing Excess Launcher
cls

set "ROOT=%~dp0"
set "QUIET=0"
if /i "%~1"=="/q" set "QUIET=1"

echo.
echo  ============================================================
echo    Sharing Excess ^| Starting All Services
echo  ============================================================
echo.

REM -- 1. Is everything installed?
if not exist "%ROOT%frontend\node_modules" (
    echo  [!] Frontend packages are not installed.
    echo      Run:  cd frontend ^&^& npm install
    echo.
    if "%QUIET%"=="0" pause
    exit /b 1
)
if not exist "%ROOT%backend\.venv\Scripts\uvicorn.exe" (
    echo  [!] backend\.venv was not found - falling back to a global uvicorn.
    echo      Recommended setup is in README.md ^(Quick start^).
    echo.
)

REM -- 2. Is PostgreSQL up? (only a warning: the database in backend\.env may live on another machine)
netstat -ano 2>nul | findstr /L ":5432 " | findstr /L "LISTENING" >nul
if errorlevel 1 (
    echo  [!] Nothing is listening on PostgreSQL port 5432 - the backend will not start without its database.
    echo      Start PostgreSQL first ^(ignore this if backend\.env points to a remote database^).
    echo.
)

REM -- 3. Are the ports free?
for %%P in (8003 5175) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P is already in use.
        echo      Run stop-services.bat first, then try again.
        echo.
        if "%QUIET%"=="0" pause
        exit /b 1
    )
)

REM -- 4. Backend, then wait until it really answers
echo  [1/2] Starting Backend API   ^| port 8003
REM cmd /c (not start's default /K): the window closes when the service ends instead of lingering at a prompt
start "Sharing Excess - Backend :8003" cmd /c ""%ROOT%_run_backend.bat""
call :wait_for "http://127.0.0.1:8003/api/health" 40 BACKEND_UP

REM -- 5. Frontend, then wait until it really answers
echo  [2/2] Starting Frontend      ^| port 5175
start "Sharing Excess - Frontend :5175" cmd /c ""%ROOT%_run_frontend.bat""
call :wait_for "http://localhost:5175/" 40 FRONTEND_UP

echo.
echo  ============================================================
if "%BACKEND_UP%"=="1" (echo    Backend API  :  http://localhost:8003   [running]) else (echo    Backend API  :  NOT ANSWERING - read the Backend window for the error)
if "%FRONTEND_UP%"=="1" (echo    Frontend     :  http://localhost:5175   [running]) else (echo    Frontend     :  NOT ANSWERING - read the Frontend window for the error)
echo    API Docs     :  http://localhost:8003/docs
echo.
echo    Services run in their own windows. Run stop-services.bat to shut them down.
echo  ============================================================
echo.
if "%QUIET%"=="0" pause
if "%BACKEND_UP%"=="1" if "%FRONTEND_UP%"=="1" exit /b 0
exit /b 1


REM ---------------------------------------------------------------------------
REM  :wait_for <url> <max seconds> <result variable>
REM  Sets the variable to 1 as soon as the URL answers, or 0 after the time is up.
REM  (ping is used as the sleep because "timeout" refuses to run without a keyboard)
REM ---------------------------------------------------------------------------
:wait_for
set "%~3=0"
for /l %%S in (1,1,%~2) do (
    curl.exe -s -f -o nul --max-time 2 "%~1" >nul 2>&1
    if not errorlevel 1 (
        set "%~3=1"
        goto :wait_for_done
    )
    ping -n 2 127.0.0.1 >nul
)
:wait_for_done
exit /b 0
