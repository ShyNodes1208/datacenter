@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo  Datacenter - Reset local data
echo ========================================
echo.
echo This will delete SQLite databases at:
echo   1) %LocalAppData%\Datacenter
echo   2) datacenter.db* in this folder
echo.
echo All business data will be removed.
echo Next start recreates login: admin / admin123
echo.
set /p confirm=Type YES to continue:
if /I not "%confirm%"=="YES" (
  echo Cancelled.
  pause
  exit /b 1
)

if exist "%LocalAppData%\Datacenter" (
  rmdir /s /q "%LocalAppData%\Datacenter"
  echo Removed %LocalAppData%\Datacenter
)

del /q "%~dp0datacenter.db" 2>nul
del /q "%~dp0datacenter.db-wal" 2>nul
del /q "%~dp0datacenter.db-shm" 2>nul
echo Removed datacenter.db* in this folder

echo.
echo Done. Run Start-Datacenter.bat again.
pause
