# Iniciar Tudo - Jyy Suite
$ErrorActionPreference = 'SilentlyContinue'
$Workspace = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  JYY - INICIANDO TUDO AUTOMATICAMENTE" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Checa se o Node.js esta instalado
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[ERRO] Node.js nao foi encontrado no sistema!" -ForegroundColor Red
    Write-Host "Por favor instale o Node.js em: https://nodejs.org/"
    Read-Host "Pressione Enter para sair..."
    exit 1
}

# 2. Testa se o servidor ja esta respondendo na porta 4870
$serverReady = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:4870/api/info" -TimeoutSec 1 -ErrorAction Stop
    if ($res.ok) { $serverReady = $true }
} catch {}

if (-not $serverReady) {
    Write-Host "[1/4] Iniciando Servidor Jyy na porta 4870..." -ForegroundColor Yellow
    $serverBat = Join-Path $Workspace "1-INICIAR-SERVIDOR.bat"
    Start-Process -FilePath $serverBat -WorkingDirectory $Workspace
    
    # Aguarda ativamente o servidor responder (ate 20 segundos)
    $attempts = 0
    while (-not $serverReady -and $attempts -lt 20) {
        Start-Sleep -Seconds 1
        $attempts++
        try {
            $check = Invoke-RestMethod -Uri "http://127.0.0.1:4870/api/info" -TimeoutSec 1 -ErrorAction Stop
            if ($check.ok) { $serverReady = $true }
        } catch {}
        Write-Host "      Aguardando servidor inicializar ($($attempts)s)..." -ForegroundColor Gray
    }
} else {
    Write-Host "[1/4] Servidor Jyy ja esta ativo e operando na porta 4870." -ForegroundColor Green
}

if ($serverReady) {
    Write-Host "      [OK] Servidor Jyy online e respondendo!" -ForegroundColor Green
} else {
    Write-Host "      [AVISO] Servidor demorou para responder, prosseguindo com a abertura..." -ForegroundColor Yellow
}

# 3. Abre a Suite Web no Navegador Padrao
Write-Host "
[2/4] Abrindo Suite Web no navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:4870/"
Start-Sleep -Milliseconds 800

# 4. Abre o Jyy Mensagens Anonimas no Navegador Padrao
Write-Host "[3/4] Abrindo Jyy Mensagens Anonimas no navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:4870/Jyy.html"
Start-Sleep -Milliseconds 800

# 5. Abre o Aplicativo Desktop
Write-Host "[4/4] Abrindo Aplicativo Desktop Jyy..." -ForegroundColor Cyan
$exePath = Join-Path $Workspace "release\Jyy-Portable.exe"
if (Test-Path $exePath) {
    Start-Process $exePath -WorkingDirectory $Workspace
} else {
    Start-Process npx -ArgumentList 'electron', 'electron/main.cjs' -WorkingDirectory $Workspace
}

Write-Host "
========================================================" -ForegroundColor Green
Write-Host "  TUDO INICIADO NA ORDEM CORRETA COM SUCESSO!" -ForegroundColor Green
Write-Host "  - 1. Servidor: http://localhost:4870/ (Console aberto)" -ForegroundColor Green
Write-Host "  - 2. Suite Web: http://localhost:4870/" -ForegroundColor Green
Write-Host "  - 3. Jyy Anonimo: http://localhost:4870/Jyy.html" -ForegroundColor Green
Write-Host "  - 4. Desktop: Jyy Portable" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Start-Sleep -Seconds 3