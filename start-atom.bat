@echo off
rem Starts ATOM GAME CLUB on this computer (after "pnpm setup:local").
rem Other devices on the same network can open http://<this-PC-IP>:3000
cd /d "%~dp0"
echo ATOM GAME CLUB - http://localhost:3000  (close this window to stop)
call pnpm start -H 0.0.0.0 -p 3000
pause
