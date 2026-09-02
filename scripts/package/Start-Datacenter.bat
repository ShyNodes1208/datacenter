@echo off
setlocal
cd /d "%~dp0"

set ASPNETCORE_ENVIRONMENT=Production
set DATACENTER_PACKAGE_MODE=1

echo 正在启动机房管理系统...
echo 请使用本窗口启动，不要直接双击 Datacenter.Api.exe
echo 浏览器将自动打开 http://127.0.0.1:5142/
echo 首次登录账号: admin / admin123
echo 关闭本窗口即可停止服务。
echo.

start "" /B Datacenter.Api.exe

set /a retries=0
:wait_loop
set /a retries+=1
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5142/api/auth/csrf | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto server_ready
if %retries% geq 30 goto server_ready
timeout /t 1 /nobreak >nul
goto wait_loop

:server_ready
start "" "http://127.0.0.1:5142/"
echo 服务已启动。
echo 若无法登录，请关闭本窗口后删除数据目录并重新启动:
echo   %%LocalAppData%%\Datacenter
echo.

:keepalive
timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq Datacenter.Api.exe" 2>nul | find /I /N "Datacenter.Api.exe">nul
if "%ERRORLEVEL%"=="0" goto keepalive

endlocal
