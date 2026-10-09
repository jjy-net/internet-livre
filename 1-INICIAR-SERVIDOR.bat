@echo off
chcp 65001 >nul
title [1] Jyy - Servidor de Rede Local (Porta 4870)
cd /d "%~dp0"

echo ========================================================
echo   [PASSO 1] INICIANDO SERVIDOR JYY (Porta 4870)
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao foi encontrado no sistema!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

echo Mantenha esta janela aberta enquanto utilizar o Jyy!
echo.
node server\start.js
echo.
echo [AVISO] O servidor foi finalizado.
pause