@echo off
title Jyy - Teste
cd /d "%~dp0"

echo [1/3] Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    pause
    exit /b 1
)
echo [OK] Node.js detectado.

echo [2/3] Verificando porta 4870...
netstat -ano | findstr :4870 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Servidor ja esta rodando na porta 4870.
) else (
    echo Servidor nao esta rodando.
)

echo [3/3] Teste concluido com sucesso!
