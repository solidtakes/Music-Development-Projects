@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
  py -3 loop_test.py --no-browser
) else (
  python loop_test.py --no-browser
)
if errorlevel 1 (
  echo.
  echo OSC bridge could not start. Existing files and Home Assistant are unchanged.
  echo If UDP 9002 is already held by another bridge, stop ONLY that bridge first.
  pause
)
