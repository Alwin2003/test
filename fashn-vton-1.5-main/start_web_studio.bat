@echo off
title FASHN VTON 1.5 - Virtual Try-On Studio Server
echo ======================================================================
echo Starting FASHN VTON 1.5 Web Studio...
echo ======================================================================

set HOST=0.0.0.0
set PORT=7860
set WEIGHTS_DIR=./weights

echo Binding to %HOST%:%PORT%
echo Access from any device via:
echo   - Local:   http://localhost:%PORT%
echo   - Network: http://%%COMPUTERNAME%%:%PORT% or http://^<YOUR_IP^>:%PORT%
echo.

python web_server.py --host %HOST% --port %PORT% --weights-dir %WEIGHTS_DIR% %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Trying with Python 3.11...
    "C:\Users\1274\.local\bin\python3.11.exe" web_server.py --host %HOST% --port %PORT% --weights-dir %WEIGHTS_DIR% %*
)

pause
