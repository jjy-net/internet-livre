@echo off
chcp 65001 >nul
title Gerador de QR Code - Modo Desenvolvimento

echo.
echo ========================================
echo   GERADOR DE QR CODE OFFLINE
echo   Modo Desenvolvimento
echo ========================================
echo.

:: Verificar se Node.js est? instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js n?o encontrado!
    echo.
    echo Por favor, instale o Node.js primeiro:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

:: Instalar depend?ncias se necess?rio
if not exist "node_modules" (
    echo Instalando depend?ncias...
    call npm install
    echo.
)

:: Iniciar o app em modo desenvolvimento
echo Iniciando aplica??o em modo desenvolvimento...
echo.
echo Pressione Ctrl+C para parar
echo.
call npm run electron-dev
