@echo off
title Gerador de QR Code - Abrindo...
:: Este arquivo abre o Gerador de QR Code que já funciona
:: Basta dar duplo clique!

:: Verifica se o arquivo existe
if exist "%~dp0..\dist\index.html" (
    start "" "%~dp0..\dist\index.html"
    exit
)

:: Se não encontrar, tenta na pasta public
if exist "%~dp0..\public\QR-Code-Offline.html" (
    start "" "%~dp0..\public\QR-Code-Offline.html"
    exit
)

:: Mensagem de erro
echo.
echo ========================================
echo   ERRO: Arquivo nao encontrado!
echo ========================================
echo.
echo Execute primeiro: npm run build
echo.
pause
