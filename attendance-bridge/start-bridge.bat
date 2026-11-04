@echo off
title Fingerprint bridge - Hotel Perfect Plaza
cd /d "%~dp0"
:loop
node zk-bridge.mjs
echo The bridge stopped. Starting it again in 10 seconds...
timeout /t 10 >nul
goto loop
