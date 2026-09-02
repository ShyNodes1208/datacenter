@echo off
setlocal
cd /d "%~dp0"

set ASPNETCORE_ENVIRONMENT=Production
set DATACENTER_PACKAGE_MODE=1

echo Starting Datacenter...
echo Use this window only. Do NOT double-click Datacenter.Api.exe.
echo Browser: http://127.0.0.1:5142/
echo Login: admin / admin123
echo Close this window to stop the service.
echo.

start "" /B Datacenter.Api.exe

set retries=0
:wait_loop
set /a retries+=1
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5142/api/auth/csrf | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto server_ready
if %retries% geq 30 goto server_ready
timeout /t 1 /nobreak >nul
goto wait_loop

:server_ready
start "" "http://127.0.0.1:5142/"
echo Service is ready.
echo If login fails, run Reset-Datacenter-Data.bat
echo Data folder: %LocalAppData%\Datacenter
echo.

:keepalive
timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq Datacenter.Api.exe" 2>nul | find /I /N "Datacenter.Api.exe">nul
if "%ERRORLEVEL%"=="0" goto keepalive

endlocal
