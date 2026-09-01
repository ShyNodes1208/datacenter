@echo off
setlocal
cd /d "%~dp0"

set ASPNETCORE_ENVIRONMENT=Production
set DATACENTER_PACKAGE_MODE=1
set BootstrapAdmin__Username=admin
set BootstrapAdmin__Password=admin123
set BootstrapAdmin__Role=机房管理员

echo 正在启动机房管理系统...
echo 浏览器将自动打开 http://127.0.0.1:5142/
echo 首次登录账号: admin / admin123
echo 关闭本窗口即可停止服务。
echo.

start "" "http://127.0.0.1:5142/"
Datacenter.Api.exe

endlocal
