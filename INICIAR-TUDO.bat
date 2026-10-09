@echo off
title Jyy - Iniciar Tudo
cd /d "%~dp0"

echo ========================================================
echo   JYY - INICIANDO TUDO DE UMA VEZ
echo   Servidor + Aplicativo
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado no sistema!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] Verificando Servidor na porta 4870...
netstat -ano | findstr :4870 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo       Iniciando Servidor Jyy...
    start "Jyy - Servidor" cmd /k node server/start.js
) else (
    echo       Servidor ja esta em execucao na porta 4870.
)

echo.
echo [2/3] Abrindo aplicacao web completa no navegador...
start http://localhost:4870/

echo.
echo [3/3] Iniciando aplicativo Desktop (Electron)...
start "" npx electron electron/main.cjs

echo.
echo ========================================================
echo   TUDO INICIADO COM SUCESSO!
echo ========================================================
echo.
echo   - Central Computador:  http://localhost:4870/ (Cameras, Admin, Chat)
echo   - Celular / Cameras:   https://localhost:4873/ ou no IP do Wi-Fi na porta 4873
echo                          (HTTPS Seguro Offline: libera Camera e Microfone em celulares)
echo   - DataLink NGL:        http://localhost:4870/DataLink-NGL.html
echo   - Aplicativo Desktop:  Aberto em janela propria (Electron)
echo.
echo Pressione qualquer tecla para fechar este aviso...
pause >nul
