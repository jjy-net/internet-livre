@echo off
chcp 65001 >nul
title [4] Jyy - Aplicativo Desktop
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-desktop.ps1"