@echo off
chcp 65001 >nul
title Gerador de QR Code - Criar Execut?vel (Pake)

echo.
echo ========================================
echo   GERADOR DE QR CODE
echo   Criar Execut?vel com Pake
echo   (Leve, WebView Nativa, Sem Antivirus)
echo ========================================
echo.

:: Verificar se PowerShell est? dispon?vel
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] PowerShell n?o encontrado!
    pause
    exit /b 1
)

echo Iniciando script PowerShell...
echo.

:: Executar o script PowerShell
powershell -ExecutionPolicy Bypass -File "%~dp0criar-exe-pake.ps1"

pause
