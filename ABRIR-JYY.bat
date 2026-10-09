@echo off
chcp 65001 >nul
title Jyy - Perguntas e Mensagens Anonimas
cd /d "%~dp0"

echo.
echo ========================================================
echo   ?? JYY - INICIALIZANDO
echo ========================================================
echo.

:: 1. Inicia o servidor se n?o estiver ativo
netstat -ano | findstr :4870 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [1/3] Iniciando o servidor Jyy...
    start "Jyy - Servidor" cmd /k "cd /d \"%~dp0\" && chcp 65001 >nul && node server/start.js"
) else (
    echo [1/3] Servidor j? est? rodando na porta 4870.
)

echo [2/3] Aguardando servidor responder...
:: Aguarda ativamente o servidor responder na porta 4870 (at? 15 segundos)
set /a tentativas=0
:loop_espera
timeout /t 1 /nobreak >nul
netstat -ano | findstr :4870 >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :servidor_pronto
set /a tentativas+=1
if %tentativas% LSS 15 (
    echo       Aguardando inicializa??o (%tentativas%s)...
    goto :loop_espera
)
echo [AVISO] O servidor demorou para responder. Abrindo arquivo diretamente...
start "" "%~dp0public\Jyy.html"
goto :fim

:servidor_pronto
echo [3/3] Servidor pronto e respondendo! Abrindo navegador...
start "" "http://localhost:4870/Jyy.html"

:fim
echo.
echo ========================================================
echo   ? Tudo pronto!
echo   Mantenha a janela "Jyy - Servidor" aberta!
echo ========================================================
echo.
timeout /t 4 >nul
