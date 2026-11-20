@echo off
echo ==========================================
echo  SUSUNO - Hubungkan HP (USB) ke Backend
echo ==========================================
set ADB_PATH="%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

if exist %ADB_PATH% (
    set ADB=%ADB_PATH%
) else (
    set ADB=adb
)

echo Memeriksa perangkat Android...
%ADB% devices
echo.
echo Mengaktifkan port reverse 5000 (HP localhost -> PC Backend)...
%ADB% reverse tcp:5000 tcp:5000
echo.
echo Status port reverse aktif:
%ADB% reverse --list
echo.
echo [OK] HP sekarang dapat mengakses backend melalui: http://localhost:5000/api
echo Silakan buka aplikasi di HP dan pilih / masukkan URL: http://localhost:5000/api
pause
