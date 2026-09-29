@echo off
title Gerador de QR Code
:: ============================================
:: GERADOR DE QR CODE - PROGRAMA PORTABLE
:: Basta dar duplo clique para usar!
:: ============================================

:: Procura o Microsoft Edge
set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

:: Se encontrou o Edge, abre em modo aplicativo (sem barra de endereço)
if defined EDGE (
    start "" "%EDGE%" --app="%~dp0QR-Code-App.html" --window-size=1100,750
    exit
)

:: Se não encontrou Edge, tenta o Google Chrome
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
    start "" "%CHROME%" --app="%~dp0QR-Code-App.html" --window-size=1100,750
    exit
)

:: Se não encontrou nenhum navegador moderno, abre o arquivo HTA (nativo do Windows)
if exist "%~dp0QR-Code.hta" (
    start "" "%~dp0QR-Code.hta"
    exit
)

:: Se nada funcionar, abre no navegador padrão
start "" "%~dp0QR-Code-App.html"
