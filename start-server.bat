@echo off
REM ============================================
REM RAM Dosya Atama - Local Server Startup
REM ============================================
REM Run this script to start the local server

echo ============================================
echo RAM Dosya Atama - Local Server
echo ============================================

REM Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo WARNING: .env.local not found!
    echo Copying from .env.local.example...
    copy .env.local.example .env.local
    echo.
    echo IMPORTANT: Please edit .env.local with your admin credentials!
    echo Then run this script again.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
)

REM Check if .next exists (built)
if not exist ".next" (
    echo Building application...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Build failed!
        pause
        exit /b 1
    )
)

REM Get local IP
echo.
echo ============================================
echo Starting server...
echo ============================================
echo.
echo Access the application at:
echo   http://localhost:3000
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   http://%%b:3000
    )
)
echo.
echo Press Ctrl+C to stop the server
echo ============================================
echo.

REM Start server
npm run start
