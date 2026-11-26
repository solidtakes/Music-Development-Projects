@echo off
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
    py -3 android_proxy.py
) else (
    python android_proxy.py
)
if errorlevel 1 echo Android companion failed. Check Python, LAN address and PRIVATE firewall permission.
pause
