@echo off
chcp 65001 >nul
title DataLink Pro - Servidor de Rede Local

echo.
echo ========================================================
echo   ?? DATALINK PRO - SERVIDOR DE REDE LOCAL (LAN)
echo   WebSocket + HTTP Server na porta 4870
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js n?o foi encontrado no sistema!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

:: Compilar app se dist n?o existir
if not exist "dist\index.html" (
    echo Compilando aplica??o web (primeira execu??o)...
    call npm run build
    echo.
)

echo Iniciando servidor DataLink Pro e abrindo navegador...
echo.
start http://localhost:4870
node server/start.js

pause
