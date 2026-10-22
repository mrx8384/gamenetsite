@echo off
rem ATOM GAME CLUB - one-click start on Windows.
rem First run: installs packages, runs the setup (database, .env, admin, catalog) and builds.
rem Later runs: just starts the site. Other devices on the network: http://<this-PC-IP>:3000
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is not installed. Install Node.js 22 LTS from https://nodejs.org and run this file again.
  goto :end
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo Enabling pnpm...
  call corepack enable
  where pnpm >nul 2>nul
  if errorlevel 1 call npm install -g pnpm@10
)

if not exist "node_modules" (
  echo Installing packages - this takes a few minutes...
  call pnpm install
  if errorlevel 1 goto :failed
)

if not exist ".env" (
  echo First-time setup...
  call pnpm setup:local
  if errorlevel 1 goto :failed
)

if not exist ".next\BUILD_ID" (
  echo Building the site - this takes a few minutes...
  call pnpm build
  if errorlevel 1 goto :failed
)

echo.
echo ATOM GAME CLUB is running: http://localhost:3000   (close this window to stop)
call pnpm start -H 0.0.0.0 -p 3000
goto :end

:failed
echo.
echo [X] Something went wrong. Send a screenshot of this window for help.

:end
pause
