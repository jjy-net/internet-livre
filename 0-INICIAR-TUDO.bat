@echo off
chcp 65001 >nul
title [0] Jyy - Iniciar Tudo Automaticamente
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-tudo.ps1"