@echo off
title FiveM Vault Bot
echo ==============================
echo   FiveM Vault Bot - Starting
echo ==============================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    npm install
    echo.
)

:: Deploy commands first
echo [INFO] Deploying slash commands...
node src/deploy-commands.js
echo.

:: Start the bot
echo [INFO] Starting bot...
node src/index.js

:: If bot crashes, pause so user can see the error
echo.
echo [ERROR] Bot stopped unexpectedly!
pause
