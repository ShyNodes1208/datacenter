@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo  机房管理系统 - 重置本地数据
echo ========================================
echo.
echo 将删除以下位置的 SQLite 数据库:
echo   1) %%LocalAppData%%\Datacenter
echo   2) 当前解压目录中的 datacenter.db*
echo.
echo 业务数据将被清空，下次启动会重建 admin / admin123
echo.
set /p confirm=若确认请输入 YES 后回车:
if /I not "%confirm%"=="YES" (
  echo 已取消。
  pause
  exit /b 1
)

if exist "%LocalAppData%\Datacenter" (
  rmdir /s /q "%LocalAppData%\Datacenter"
  echo 已删除 %%LocalAppData%%\Datacenter
)

del /q "%~dp0datacenter.db" 2>nul
del /q "%~dp0datacenter.db-wal" 2>nul
del /q "%~dp0datacenter.db-shm" 2>nul
echo 已清理当前目录中的 datacenter.db*

echo.
echo 完成。请双击 Start-Datacenter.bat 重新启动。
pause
