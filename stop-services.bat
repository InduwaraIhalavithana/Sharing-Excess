@echo off
title Sharing Excess ^| Stop Services
cls

echo.
echo  ============================================================
echo    Sharing Excess ^| Stopping All Services
echo  ============================================================
echo.

REM -- Step 1: close the two service windows by title (also ends their child processes)
echo  Closing service windows...
taskkill /F /T /FI "WINDOWTITLE eq Sharing Excess - Backend :8003"  >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq Sharing Excess - Frontend :5175" >nul 2>&1

timeout /t 1 /nobreak >nul

REM -- Step 2: whatever still listens on the two ports. uvicorn --reload leaves a worker process behind that keeps the
REM -- port open after its parent dies, so also stop every python/node process that was started from this folder.
echo  Cleaning up leftover processes on ports 8003, 5175...
for %%P in (8003 5175) do (
    for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr /L ":%%P " ^| findstr /L "LISTENING"') do (
        if not "%%i"=="0" taskkill /F /T /PID %%i >nul 2>&1
    )
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path '%~dp0').Path.TrimEnd('\'); Get-CimInstance Win32_Process | Where-Object { ($_.Name -match '^(python|pythonw|node|uvicorn)(\.exe)?$') -and $_.CommandLine -and $_.CommandLine.Contains($root) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

timeout /t 2 /nobreak >nul

REM -- Step 3: verify
echo.
set "REMAINING=0"
for %%P in (8003 5175) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P still in use.
        set "REMAINING=1"
    )
)

if "%REMAINING%"=="0" (
    echo  All Sharing Excess services stopped cleanly.
) else (
    echo.
    echo  Some ports are still occupied. Try running as Administrator.
)

echo.
if /i not "%~1"=="/q" pause
