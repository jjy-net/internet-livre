# Abrir Desktop - Jyy Suite
$ErrorActionPreference = 'SilentlyContinue'
$Workspace = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  JYY - ABRINDO APLICATIVO DESKTOP" -ForegroundColor Cyan
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

$exePath = Join-Path $Workspace "release\Jyy-Portable.exe"
if (Test-Path $exePath) {
    Write-Host "Abrindo Jyy Portable ($exePath)..." -ForegroundColor Green
    Start-Process $exePath -WorkingDirectory $Workspace
} else {
    Write-Host "Abrindo via Electron dev..." -ForegroundColor Green
    Start-Process npx -ArgumentList 'electron', 'electron/main.cjs' -WorkingDirectory $Workspace
}
Start-Sleep -Seconds 2