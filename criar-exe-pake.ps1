# Gerador de QR Code - Criar Executável com Pake
# Pake usa WebView2 nativa do Windows (leve, ~2-5MB, sem antivírus)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GERADOR DE QR CODE - CRIAR EXECUTÁVEL" -ForegroundColor Cyan
Write-Host "  Usando Pake (WebView Nativa)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Node.js está instalado
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "[ERRO] Node.js não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale o Node.js primeiro:" -ForegroundColor Yellow
    Write-Host "https://nodejs.org/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ou use o HTML standalone diretamente:" -ForegroundColor Yellow
    Write-Host "public\qr-generator-standalone.html" -ForegroundColor Green
    Write-Host ""
    pause
    exit 1
}

Write-Host "[OK] Node.js encontrado" -ForegroundColor Green
node --version
Write-Host ""

# Verificar se o HTML standalone existe
$htmlFile = "public\qr-generator-standalone.html"
if (-not (Test-Path $htmlFile)) {
    Write-Host "[ERRO] Arquivo HTML não encontrado: $htmlFile" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "[OK] HTML standalone encontrado" -ForegroundColor Green
Write-Host ""

# Instalar Pake CLI
Write-Host "[1/3] Instalando Pake CLI..." -ForegroundColor Yellow
npm install -g pake-cli
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha ao instalar Pake" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tente executar como Administrador" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host "[OK] Pake instalado" -ForegroundColor Green
Write-Host ""

# Criar executável
Write-Host "[2/3] Criando executável..." -ForegroundColor Yellow
Write-Host "Isso pode levar 1-2 minutos..." -ForegroundColor Gray
Write-Host ""

# Criar pasta de saída
$outputDir = "release-pake"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# Converter caminho absoluto
$htmlPath = Resolve-Path $htmlFile

# Executar Pake
pake $htmlPath --name "Gerador-QR-Code" --width 1200 --height 800 --transparent --fullscreen --output $outputDir

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERRO] Falha ao criar executável" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternativas:" -ForegroundColor Yellow
    Write-Host "1. Use o HTML standalone diretamente (funciona offline)" -ForegroundColor Cyan
    Write-Host "2. Tente executar como Administrador" -ForegroundColor Cyan
    Write-Host "3. Use WebCatalog (https://webcatalog.io)" -ForegroundColor Cyan
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "[OK] Executável criado!" -ForegroundColor Green
Write-Host ""

# Verificar se o executável foi criado
$exeFiles = Get-ChildItem -Path $outputDir -Filter "*.exe" -ErrorAction SilentlyContinue
if ($exeFiles) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Executável criado:" -ForegroundColor Cyan
    Write-Host "  $($exeFiles[0].FullName)" -ForegroundColor White
    Write-Host ""
    Write-Host "Tamanho: $([math]::Round($exeFiles[0].Length / 1MB, 2)) MB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Vantagens do Pake:" -ForegroundColor Yellow
    Write-Host "  ✓ Usa WebView2 nativa do Windows" -ForegroundColor Green
    Write-Host "  ✓ Muito leve (~2-5 MB)" -ForegroundColor Green
    Write-Host "  ✓ Não dispara antivírus" -ForegroundColor Green
    Write-Host "  ✓ Funciona offline" -ForegroundColor Green
    Write-Host "  ✓ Sem permissões especiais" -ForegroundColor Green
    Write-Host ""
    
    # Perguntar se quer abrir a pasta
    $openFolder = Read-Host "Deseja abrir a pasta do executável? (S/N)"
    if ($openFolder -eq 'S' -or $openFolder -eq 's') {
        explorer $outputDir
    }
} else {
    Write-Host "[AVISO] Executável não encontrado na pasta $outputDir" -ForegroundColor Yellow
    Write-Host "Verifique manualmente" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Processo concluído!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
pause
