@echo off
chcp 65001 >nul
title Gerador de QR Code - Instalação Automática

echo.
echo ========================================
echo   GERADOR DE QR CODE OFFLINE
echo   Instalador Automático
echo ========================================
echo.

:: Verificar se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js não encontrado!
    echo.
    echo ========================================
    echo   INSTALAÇÃO DO NODE.JS NECESSÁRIA
    echo ========================================
    echo.
    echo Este aplicativo precisa do Node.js para funcionar.
    echo.
    echo Deseja abrir o site de download do Node.js?
    choice /C YN /M "Pressione Y para Sim, N para Não"
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
    echo Após instalar o Node.js, execute este script novamente.
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

echo ========================================
echo   INICIANDO INSTALAÇÃO AUTOMÁTICA
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

:: Passo 2: Instalar dependências
echo [2/5] Instalando dependências...
echo Isso pode levar alguns minutos...
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao instalar dependências
    pause
    exit /b 1
)
echo [OK] Dependências instaladas
echo.

:: Passo 3: Build do React
echo [3/5] Compilando aplicação React...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao compilar aplicação
    pause
    exit /b 1
)
echo [OK] Aplicação compilada
echo.

:: Passo 4: Gerar executável portable
echo [4/5] Gerando executável portable...
echo Isso pode levar 2-5 minutos...
echo.
call npx electron-builder --win portable
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao gerar executável
    pause
    exit /b 1
)
echo.

:: Passo 5: Verificar e abrir pasta
echo [5/5] Verificando executável gerado...
if exist "release\Gerador QR Code Offline-Portable.exe" (
    echo.
    echo ========================================
    echo   ✅ SUCESSO!
    echo ========================================
    echo.
    echo Executável criado com sucesso!
    echo.
    echo 📁 Local: release\Gerador QR Code Offline-Portable.exe
    echo.
    echo ========================================
    echo   COMO USAR
    echo ========================================
    echo.
    echo 1. O arquivo .exe está na pasta "release"
    echo 2. Você pode copiar para qualquer lugar
    echo 3. Execute clicando duas vezes
    echo 4. Não precisa instalar nada!
    echo.
    echo Deseja abrir a pasta do executável agora?
    choice /C YN /M "Pressione Y para Sim, N para Não"
    if errorlevel 2 goto :fim
    explorer "release"
) else (
    echo [ERRO] Executável não encontrado na pasta release
    echo.
    echo Verifique se houve algum erro durante o processo.
    pause
    exit /b 1
)

:fim
echo.
echo ========================================
echo   Processo concluído!
echo ========================================
echo.
echo Para executar o app novamente, use:
echo   - rodar-app.bat (modo desenvolvimento)
echo   - Ou execute o .exe na pasta release
echo.
pause
