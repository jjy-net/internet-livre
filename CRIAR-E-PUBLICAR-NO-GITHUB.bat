@echo off
chcp 65001 >nul
title Publicar Projeto Jyy no GitHub (Publico e Open Source)
color 0B

echo ======================================================================
echo    🌐 PUBLICAR REPOSITÓRIO PÚBLICO E OPEN SOURCE DO JYY NO GITHUB
echo ======================================================================
echo.
echo Este script vai:
echo   1. Conectar com sua conta do GitHub;
echo   2. Criar o repositório PÚBLICO oficial do JYY;
echo   3. Liberar o código para TODOS poderem VER, BAIXAR e MODIFICAR (Licença MIT);
echo   4. Enviar todo o projeto, Globo 3D, Radar RuView e Documentação!
echo.
echo ======================================================================
echo.

:: 1. Verificar se o GitHub CLI já está autenticado
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo [PASSO 1/3] AUTENTICANDO COM O GITHUB...
    echo.
    echo ⚠️  ATENÇÃO: Na próxima linha vai aparecer uma mensagem como:
    echo     "! First copy your one-time code: XXXX-XXXX"
    echo.
    echo 1. COPIE O CÓDIGO de 8 letras/números que aparecer na tela preta.
    echo 2. Pressione ENTER para abrir a página do GitHub no seu navegador.
    echo 3. Cole o código no site do GitHub e clique em "Authorize".
    echo.
    echo Pressione ENTER para iniciar a conexão...
    pause >nul
    call gh auth login -w -p https
) else (
    echo [PASSO 1/3] ✅ Conta do GitHub já está conectada!
)

echo.
echo [PASSO 2/3] Criando repositório PÚBLICO no seu GitHub...
call gh repo create jyy --public --source=. --remote=origin --description "Jyy v2.0 - Suite Soberana de Transmissao e Internet Livre com Globo 3D, Radar RuView e Mesh P2P (Open Source)"

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] O repositório já existe ou o link remoto já está configurado. Prosseguindo com o envio...
)

echo.
echo [PASSO 3/3] Enviando todo o código para o GitHub (git push)...
git branch -M main
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  🎉 SUCESSO! SEU REPOSITÓRIO ESTÁ 100%% PÚBLICO NO GITHUB!
    echo.
    echo  Qualquer pessoa no mundo agora pode:
    echo    • Ver todo o código-fonte e documentação
    echo    • Clonar e testar no seu computador
    echo    • Enviar modificações e melhorias (Pull Requests / Forks)
    echo.
    echo  Abrindo a página pública do seu repositório no navegador...
    echo ======================================================================
    call gh repo view --web
) else (
    echo.
    echo [ERRO] Ocorreu uma falha ao enviar. Verifique se o login foi concluído com sucesso.
)

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
