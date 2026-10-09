# Script PowerShell para criar atalhos numerados na ordem correta com icones
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$WorkspacePath = $PSScriptRoot
$AtalhosLocalDir = Join-Path $WorkspacePath "Atalhos Jyy"

$DesktopFolderDir = Join-Path $DesktopPath "Jyy - Atalhos"

if (-not (Test-Path $AtalhosLocalDir)) {
    New-Item -ItemType Directory -Path $AtalhosLocalDir | Out-Null
}
if (-not (Test-Path $DesktopFolderDir)) {
    New-Item -ItemType Directory -Path $DesktopFolderDir | Out-Null
}

$JyyIco = Join-Path $WorkspacePath "app-icon.ico"
$JyyExe = Join-Path $WorkspacePath "release\Jyy-Portable.exe"

$shortcuts = @(
    @{
        Name = "0 - Iniciar Tudo Jyy Automaticamente.lnk"
        Target = Join-Path $WorkspacePath "0-INICIAR-TUDO.bat"
        Desc = "[0] Iniciar Tudo de uma vez: Servidor, Web, Chat e Desktop Jyy"
        Icon = "$JyyIco,0"
    },
    @{
        Name = "0 - Iniciar Tudo Automaticamente.lnk"
        Target = Join-Path $WorkspacePath "0-INICIAR-TUDO.bat"
        Desc = "[0] Iniciar Tudo de uma vez: Servidor, Web, Chat e Desktop Jyy"
        Icon = "$JyyIco,0"
    },
    @{
        Name = "1 - Iniciar Servidor Jyy.lnk"
        Target = Join-Path $WorkspacePath "1-INICIAR-SERVIDOR.bat"
        Desc = "[1] Iniciar Servidor Jyy (Porta 4870 - Necessario para rede local e sincronizacao)"
        Icon = "C:\Windows\System32\shell32.dll,18"
    },
    @{
        Name = "2 - Abrir Jyy Web & Chat.lnk"
        Target = Join-Path $WorkspacePath "2-ABRIR-JYY-WEB.bat"
        Desc = "[2] Abrir Suite Web e Chat LAN Jyy no Navegador (http://localhost:4870/)"
        Icon = "C:\Windows\System32\shell32.dll,14"
    },
    @{
        Name = "3 - Abrir Jyy Mensagens Anonimas.lnk"
        Target = Join-Path $WorkspacePath "3-ABRIR-JYY-ANONIMO.bat"
        Desc = "[3] Abrir Caixa de Perguntas e Mensagens Anonimas Jyy (http://localhost:4870/Jyy.html)"
        Icon = "C:\Windows\System32\shell32.dll,172"
    },
    @{
        Name = "4 - Abrir Jyy Aplicativo Desktop.lnk"
        Target = Join-Path $WorkspacePath "4-ABRIR-JYY-DESKTOP.bat"
        Desc = "[4] Abrir Aplicativo Desktop Jyy Portable"
        Icon = if (Test-Path $JyyExe) { "$JyyExe,0" } else { "$JyyIco,0" }
    },
    @{
        Name = "Jyy - Aplicativo Portable.lnk"
        Target = $JyyExe
        Desc = "Jyy Aplicativo Desktop Executavel Portatil"
        Icon = "$JyyExe,0"
    }
)

Write-Host "Criando atalhos na Area de Trabalho, na pasta 'Jyy - Atalhos' e localmente..." -ForegroundColor Cyan

foreach ($s in $shortcuts) {
    # 1. Cria na Area de Trabalho (Desktop)
    $destDesktop = Join-Path $DesktopPath $s.Name
    $linkDesktop = $WshShell.CreateShortcut($destDesktop)
    $linkDesktop.TargetPath = $s.Target
    $linkDesktop.WorkingDirectory = $WorkspacePath
    $linkDesktop.Description = $s.Desc
    $linkDesktop.IconLocation = $s.Icon
    $linkDesktop.Save()
    Write-Host "  [OK] Desktop: $($s.Name)" -ForegroundColor Green

    # 2. Cria na pasta dedicada 'Jyy - Atalhos' no Desktop
    $destDesktopFolder = Join-Path $DesktopFolderDir $s.Name
    $linkDesktopFolder = $WshShell.CreateShortcut($destDesktopFolder)
    $linkDesktopFolder.TargetPath = $s.Target
    $linkDesktopFolder.WorkingDirectory = $WorkspacePath
    $linkDesktopFolder.Description = $s.Desc
    $linkDesktopFolder.IconLocation = $s.Icon
    $linkDesktopFolder.Save()

    # 3. Cria tambem na pasta local 'Atalhos Jyy'
    $destLocal = Join-Path $AtalhosLocalDir $s.Name
    $linkLocal = $WshShell.CreateShortcut($destLocal)
    $linkLocal.TargetPath = $s.Target
    $linkLocal.WorkingDirectory = $WorkspacePath
    $linkLocal.Description = $s.Desc
    $linkLocal.IconLocation = $s.Icon
    $linkLocal.Save()
    Write-Host "  [OK] Pasta Local: $($s.Name)" -ForegroundColor Green
}

# Atualiza atalhos antigos se existirem
$oldLink = Join-Path $DesktopPath "DataLink Pro - Iniciar Tudo.lnk"
if (Test-Path $oldLink) {
    $upd = $WshShell.CreateShortcut($oldLink)
    $upd.TargetPath = Join-Path $WorkspacePath "0-INICIAR-TUDO.bat"
    $upd.WorkingDirectory = $WorkspacePath
    $upd.IconLocation = "$JyyIco,0"
    $upd.Save()
    Write-Host "  [OK] Atualizado atalho antigo: DataLink Pro - Iniciar Tudo.lnk" -ForegroundColor Yellow
}

$oldJyyLink = Join-Path $DesktopPath "jyy - Atalho.lnk"
if (Test-Path $oldJyyLink) {
    $updJyy = $WshShell.CreateShortcut($oldJyyLink)
    $updJyy.TargetPath = $JyyExe
    $updJyy.WorkingDirectory = $WorkspacePath
    $updJyy.IconLocation = "$JyyExe,0"
    $updJyy.Save()
    Write-Host "  [OK] Atualizado atalho antigo: jyy - Atalho.lnk" -ForegroundColor Yellow
}

Write-Host "`nTodos os atalhos foram criados na Area de Trabalho e na pasta 'Jyy - Atalhos' com sucesso!" -ForegroundColor Green
