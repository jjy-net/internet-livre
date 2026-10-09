@echo off
chcp 65001 >nul
title Jyy - Perguntas e Mensagens Anônimas
cd /d "%~dp0.."

if exist "ABRIR-JYY.bat" (
    call "ABRIR-JYY.bat"
) else (
    start "" "%~dp0Jyy.html"
)
