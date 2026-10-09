@echo off
chcp 65001 >nul
title Criar Atalhos Jyy
cd /d "%~dp0"

echo ========================================================
echo   CRIANDO ATALHOS NUMERADOS JYY COM ICONES
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0criar-atalhos-ordenados.ps1"

echo.
pause