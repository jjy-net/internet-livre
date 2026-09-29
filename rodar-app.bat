@echo off
chcp 65001 >nul
title Gerador de QR Code - Modo Desenvolvimento

echo.
echo ========================================
echo   GERADOR DE QR CODE OFFLINE
echo   Modo Desenvolvimento
echo ========================================
echo.

:: Verificar se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js não encontrado!
    echo.
    echo Por favor, instale o Node.js primeiro:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

:: Instalar dependências se necessário
if not exist "node_modules" (
    echo Instalando dependências...
    call npm install
    echo.
)

:: Iniciar o app em modo desenvolvimento
echo Iniciando aplicação em modo desenvolvimento...
echo.
echo Pressione Ctrl+C para parar
echo.
call npm run electron-dev
