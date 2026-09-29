@echo off
title Abrindo Gerador de QR Code...
:: Este arquivo abre o Gerador de QR Code
:: Basta dar duplo clique!

:: Verifica se o arquivo HTA existe
if exist "%~dp0QR-Code.hta" (
    start "" "%~dp0QR-Code.hta"
    exit
)

:: Se não encontrou, mostra mensagem de erro
echo.
echo ========================================
echo   ERRO: Arquivo nao encontrado!
echo ========================================
echo.
echo O arquivo "QR-Code.hta" nao foi encontrado.
echo.
echo Certifique-se de que os arquivos estao na mesma pasta:
echo   - QR-Code.hta
echo   - Abrir-QR-Code.bat
echo.
pause
