@echo off
chcp 65001 >nul
title Gerador de QR Code - Criar Executável Portable

echo.
echo ========================================
echo   GERADOR DE QR CODE OFFLINE
echo   Criar Executável Portable para Windows
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
node --version
echo.

:: Verificar se npm está instalado
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] npm não encontrado!
    pause
    exit /b 1
)

echo [OK] npm encontrado
npm --version
echo.

:: Instalar dependências
echo [1/4] Instalando dependências...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao instalar dependências
    pause
    exit /b 1
)
echo [OK] Dependências instaladas
echo.

:: Build do React
echo [2/4] Compilando aplicação React...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao compilar aplicação
    pause
    exit /b 1
)
echo [OK] Aplicação compilada
echo.

:: Gerar executável portable
echo [3/4] Gerando executável portable...
echo Isso pode levar alguns minutos...
echo.
call npx electron-builder --win portable
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao gerar executável
    pause
    exit /b 1
)
echo.

:: Verificar se o executável foi criado
echo [4/4] Verificando executável gerado...
if exist "release\Gerador QR Code Offline-Portable.exe" (
    echo.
    echo ========================================
    echo   SUCESSO!
    echo ========================================
    echo.
    echo Executável criado com sucesso!
    echo.
    echo Local: release\Gerador QR Code Offline-Portable.exe
    echo.
    echo Você pode copiar este arquivo para qualquer lugar
    echo e executá-lo diretamente, sem instalação!
    echo.
    echo Deseja abrir a pasta do executável?
    choice /C YN /M "Pressione Y para Sim, N para Não"
    if errorlevel 2 exit /b 0
    explorer "release"
) else (
    echo [ERRO] Executável não encontrado na pasta release
    pause
    exit /b 1
)

echo.
echo ========================================
echo Processo concluído!
echo ========================================
pause
