@echo off
chcp 65001 >nul
title Publicar Projeto Jyy no GitHub
color 0B

echo ======================================================================
echo    🚀 PUBLICADOR AUTOMÁTICO DO JYY NO GITHUB
echo ======================================================================
echo.
echo Este assistente vai criar o repositório público no seu GitHub e
echo enviar todo o código-fonte e documentação automaticamente.
echo.

:: 1. Verificar se o GitHub CLI está autenticado
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] Conectando a sua conta do GitHub...
    echo Uma janela do navegador vai abrir para você fazer login no GitHub.
    echo Pressione Enter para continuar...
    pause >nul
    call gh auth login -w -p https
)

echo.
echo [2/3] Criando repositório público no seu GitHub...
call gh repo create jyy --public --source=. --remote=origin --description "Jyy v2.0 - Suite Soberana de Transmissao e Internet Livre com Globo 3D, Radar RuView e Mesh P2P"

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] O repositório pode já existir ou a origem já foi configurada.
)

echo.
echo [3/3] Enviando código para o GitHub (git push)...
git branch -M main
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  ✅ CONCLUÍDO COM SUCESSO!
    echo  Seu projeto e documentação estão públicos no GitHub!
    echo  Abrindo a página do seu repositório no navegador...
    echo ======================================================================
    call gh repo view --web
) else (
    echo.
    echo [ERRO] Ocorreu uma falha ao enviar. Verifique sua conexão e login.
)

echo.
pause
