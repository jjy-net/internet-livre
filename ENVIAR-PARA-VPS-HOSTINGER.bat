@echo off
chcp 65001 >nul
title Enviar Arquivos para VPS Hostinger
color 0B

echo ======================================================================
echo    🚀 ENVIAR JYY PARA VPS HOSTINGER (jyy.com.br)
echo ======================================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0ENVIAR-PARA-VPS-HOSTINGER.ps1"
pause
