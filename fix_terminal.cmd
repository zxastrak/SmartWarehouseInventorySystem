@echo off
:: Script untuk mengatasi terminal terblokir Smart App Control (SAC) di Windows 11
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Meminta izin Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [1/2] Menonaktifkan pemblokiran Smart App Control di registri...
powershell -Command "Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -Name 'VerifiedAndReputablePolicyState' -Value 0 -Type DWord -Force; CiTool.exe -r"

echo [2/2] Unblock file pty.node...
powershell -Command "Unblock-File -Path 'D:\Antigravity IDE\resources\app\node_modules\node-pty\build\Release\pty.node' -ErrorAction SilentlyContinue"

echo.
echo ========================================================
echo  BERHASIL! Silakan Restart / Buka ulang Antigravity IDE.
echo ========================================================
echo.
pause
