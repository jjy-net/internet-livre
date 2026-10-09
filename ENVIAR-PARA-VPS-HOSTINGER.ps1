# Script PowerShell para Enviar os Arquivos do Jyy para a VPS Hostinger
param (
    [string]$VpsIp = ""
)

Clear-Host
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   🚀 ENVIAR ARQUIVOS DO JYY PARA VPS HOSTINGER (jyy.com.br)         " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $VpsIp) {
    $VpsIp = Read-Host "Digite o IP da sua VPS Hostinger (ex: 185.123.45.67)"
}

if (-not $VpsIp) {
    Write-Host "❌ IP não informado. Operação cancelada." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "1. Conectando e criando a pasta /var/www/jyy na VPS..." -ForegroundColor Yellow
ssh root@$VpsIp "mkdir -p /var/www/jyy"

Write-Host ""
Write-Host "2. Enviando arquivos via SCP (isso pode levar alguns segundos)..." -ForegroundColor Yellow

$excludeArgs = @(
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=release"
)

# Upload usando scp ou rsync
scp -r * root@${VpsIp}:/var/www/jyy/

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  ✅ ARQUIVOS ENVIADOS COM SUCESSO!" -ForegroundColor Green
Write-Host ""
Write-Host "  Agora conecte na sua VPS via SSH:" -ForegroundColor White
Write-Host "     ssh root@$VpsIp" -ForegroundColor Cyan
Write-Host ""
Write-Host "  E rode o instalador automático:" -ForegroundColor White
Write-Host "     cd /var/www/jyy" -ForegroundColor Cyan
Write-Host "     bash install-vps-hostinger.sh" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Pause
