# Abrir Web - Jyy Suite
$ErrorActionPreference = 'SilentlyContinue'
$Workspace = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  JYY - ABRINDO SUITE WEB & CHAT LAN" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$serverReady = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:4870/api/info" -TimeoutSec 1 -ErrorAction Stop
    if ($res.ok) { $serverReady = $true }
} catch {}

if (-not $serverReady) {
    Write-Host "Servidor offline. Iniciando servidor Jyy..." -ForegroundColor Yellow
    $serverBat = Join-Path $Workspace "1-INICIAR-SERVIDOR.bat"
    Start-Process -FilePath $serverBat -WorkingDirectory $Workspace
    $attempts = 0
    while (-not $serverReady -and $attempts -lt 20) {
        Start-Sleep -Seconds 1
        $attempts++
        try {
            $check = Invoke-RestMethod -Uri "http://127.0.0.1:4870/api/info" -TimeoutSec 1 -ErrorAction Stop
            if ($check.ok) { $serverReady = $true }
        } catch {}
    }
}

Write-Host "Abrindo http://localhost:4870/ no navegador..." -ForegroundColor Green
Start-Process "http://localhost:4870/"
Start-Sleep -Seconds 2