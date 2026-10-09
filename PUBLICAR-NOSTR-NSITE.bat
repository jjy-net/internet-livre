@echo off
chcp 65001 >nul
title Publicar Jyy na Rede Nostr / Blossom (nsyte)
color 0B

echo ======================================================================
echo    ?? PUBLICADOR DESCENTRALIZADO JYY NA REDE NOSTR
echo    Tecnologia: nsyte (NIP-5A / Blossom / Nsite Sovereign Web)
echo ======================================================================
echo.
echo [1/3] Compilando a aplicacao web estatica (dist/)...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] Falha ao compilar o projeto com Vite.
    pause
    exit /b %errorlevel%
)
echo.
echo [2/3] Validando configuracao .nsite/config.json...
if not exist "%~dp0nsyte.exe" (
    echo [AVISO] nsyte.exe nao encontrado localmente. Tentando via npx...
    call npx -y jsr run @nsyte/cli deploy ./dist --fallback=/index.html --skip-secrets-scan
) else (
    "%~dp0nsyte.exe" validate
    echo.
    echo [3/3] Iniciando publicacao descentralizada...
    echo.
    echo ?? Se for sua primeira vez, escolha:
    echo    1. "Generate a new private key" (para criar uma identidade Nostr propria)
    echo    ou insira sua chave nsec/bunker existente.
    echo.
    "%~dp0nsyte.exe" deploy ./dist --fallback=/index.html --skip-secrets-scan
)

echo.
echo ======================================================================
echo  ? Concluido! Seu site soberano estara acessivel globalmente via:
echo     https://[seu-npub].nsite.lol
echo ======================================================================
echo.
pause
