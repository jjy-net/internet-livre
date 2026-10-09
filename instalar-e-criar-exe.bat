@echo off
chcp 65001 >nul
title Jyy - Instala??o Autom?tica

echo.
echo ========================================
echo   JYY - SUITE OFFLINE & P2P
echo   Instalador Autom?tico
echo ========================================
echo.

:: Verificar se Node.js est? instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js n?o encontrado!
    echo.
    echo ========================================
    echo   INSTALA??O DO NODE.JS NECESS?RIA
    echo ========================================
    echo.
    echo Este aplicativo precisa do Node.js para funcionar.
    echo.
    echo Deseja abrir o site de download do Node.js?
    choice /C YN /M "Pressione Y para Sim, N para N?o"
    if errorlevel 2 (
        echo.
        echo Por favor, instale o Node.js manualmente:
        echo https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
    start https://nodejs.org/
    echo.
    echo Ap?s instalar o Node.js, execute este script novamente.
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

echo ========================================
echo   INICIANDO INSTALA??O AUTOM?TICA
echo ========================================
echo.

:: Passo 1: Configurar package.json
echo [1/5] Configurando package.json...
node setup-electron.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao configurar package.json
    pause
    exit /b 1
)
echo.

:: Passo 2: Instalar depend?ncias
echo [2/5] Instalando depend?ncias...
echo Isso pode levar alguns minutos...
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao instalar depend?ncias
    pause
    exit /b 1
)
echo [OK] Depend?ncias instaladas
echo.

:: Passo 3: Build do React
echo [3/5] Compilando aplica??o React...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao compilar aplica??o
    pause
    exit /b 1
)
echo [OK] Aplica??o compilada
echo.

:: Passo 4: Gerar execut?vel portable
echo [4/5] Gerando execut?vel portable...
echo Isso pode levar 2-5 minutos...
echo.
call npx electron-builder --win portable
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao gerar execut?vel
    pause
    exit /b 1
)
echo.

:: Passo 5: Verificar e abrir pasta
echo [5/5] Verificando execut?vel gerado...
if exist "release\Jyy-Portable.exe" (
    echo.
    echo ========================================
    echo   ? SUCESSO!
    echo ========================================
    echo.
    echo Execut?vel criado com sucesso!
    echo.
    echo ?? Local: release\Jyy-Portable.exe
    echo.
    echo ========================================
    echo   COMO USAR
    echo ========================================
    echo.
    echo 1. O arquivo .exe est? na pasta "release"
    echo 2. Voc? pode copiar para qualquer lugar
    echo 3. Execute clicando duas vezes
    echo 4. N?o precisa instalar nada!
    echo.
    echo Deseja abrir a pasta do execut?vel agora?
    choice /C YN /M "Pressione Y para Sim, N para N?o"
    if errorlevel 2 goto :fim
    explorer "release"
) else (
    echo [ERRO] Execut?vel n?o encontrado na pasta release
    echo.
    echo Verifique se houve algum erro durante o processo.
    pause
    exit /b 1
)

:fim
echo.
echo ========================================
echo   Processo conclu?do!
echo ========================================
echo.
echo Para executar o app novamente, use:
echo   - rodar-app.bat (modo desenvolvimento)
echo   - Ou execute o .exe na pasta release
echo.
pause
