@echo off
chcp 65001 >nul
title Gerar Pacote para Hospedagem Hostinger (public_html)
color 0A

echo ======================================================================
echo    📦 GERADOR DE PACOTE ZIP PARA HOSTINGER (jyy.com.br)
echo ======================================================================
echo.
echo [1/2] Compilando versao web de producao com .htaccess...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] Falha ao compilar com Vite.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Criando arquivo jyy-hostinger.zip...
if exist "%~dp0jyy-hostinger.zip" del /f /q "%~dp0jyy-hostinger.zip"

powershell -Command "Compress-Archive -Path '%~dp0dist\*' -DestinationPath '%~dp0jyy-hostinger.zip' -Force"

if exist "%~dp0jyy-hostinger.zip" (
    echo.
    echo ======================================================================
    echo  ✅ SUCESSO! Arquivo gerado: jyy-hostinger.zip
    echo.
    echo  Como postar na Hostinger:
    echo  1. Acesse o hPanel (hpanel.hostinger.com)
    echo  2. Va em: Gerenciador de Arquivos -> public_html
    echo  3. Envie o arquivo jyy-hostinger.zip
    echo  4. Clique com botao direito nele e escolha "Extrair" (Extract)
    echo.
    echo  Seu site jyy.com.br estara no ar imediatamente com SSL!
    echo ======================================================================
) else (
    echo [ERRO] Falha ao gerar o arquivo ZIP.
)

echo.
pause
