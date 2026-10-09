@echo off
chcp 65001 >nul
title Jyy - Criar Execut?vel Portable

echo.
echo ========================================
echo   JYY - SUITE OFFLINE & P2P
echo   Criar Execut?vel Portable para Windows
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
node --version
echo.

:: Verificar se npm est? instalado
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] npm n?o encontrado!
    pause
    exit /b 1
)

echo [OK] npm encontrado
npm --version
echo.

:: Instalar depend?ncias
echo [1/4] Instalando depend?ncias...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao instalar depend?ncias
    pause
    exit /b 1
)
echo [OK] Depend?ncias instaladas
echo.

:: Build do React
echo [2/4] Compilando aplica??o React...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao compilar aplica??o
    pause
    exit /b 1
)
echo [OK] Aplica??o compilada
echo.

:: Gerar execut?vel portable
echo [3/4] Gerando execut?vel portable...
echo Isso pode levar alguns minutos...
echo.
call npx electron-builder --win portable
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao gerar execut?vel
    pause
    exit /b 1
)
echo.

:: Verificar se o execut?vel foi criado
echo [4/4] Verificando execut?vel gerado...
if exist "release\Jyy-Portable.exe" (
    echo.
    echo ========================================
    echo   SUCESSO!
    echo ========================================
    echo.
    echo Execut?vel criado com sucesso!
    echo.
    echo Local: release\Jyy-Portable.exe
    echo.
    echo Voc? pode copiar este arquivo para qualquer lugar
    echo e execut?-lo diretamente, sem instala??o!
    echo.
    echo Deseja abrir a pasta do execut?vel?
    choice /C YN /M "Pressione Y para Sim, N para N?o"
    if errorlevel 2 exit /b 0
    explorer "release"
) else (
    echo [ERRO] Execut?vel n?o encontrado na pasta release
    pause
    exit /b 1
)

echo.
echo ========================================
echo Processo conclu?do!
echo ========================================
pause
