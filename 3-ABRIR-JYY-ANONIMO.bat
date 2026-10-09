@echo off
chcp 65001 >nul
title [3] Jyy - Mensagens Anonimas
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-anonimo.ps1"