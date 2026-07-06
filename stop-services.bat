@echo off
title Sharing Excess ^| Stop Services
cls

echo.
echo  ============================================================
echo    Sharing Excess ^| Stopping All Services
echo  ============================================================
echo.

REM ── Step 1: Kill the cmd windows by title ───────────────────────────────────
echo  Closing service windows...
taskkill /F /T /FI "WINDOWTITLE eq Sharing Excess - Backend :8003"  >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq Sharing Excess - Frontend :5175" >nul 2>&1

timeout /t 1 /nobreak >nul

REM ── Step 2: Port cleanup ────────────────────────────────────────────────────
echo  Cleaning up leftover processes on ports 8003, 5175...
for %%P in (8003 5175) do (
    for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr /L ":%%P " ^| findstr /L "LISTENING"') do (
        if not "%%i"=="" (
            taskkill /F /T /PID %%i >nul 2>&1
        )
    )
)

timeout /t 1 /nobreak >nul

REM ── Step 3: Verify ───────────────────────────────────────────────────────────
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
pause
