@echo off
chcp 65001 >nul
title [2] Jyy - Abrir Web e Chat LAN
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-web.ps1"