$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "Jyy - Iniciar Tudo.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $PSScriptRoot "INICIAR-TUDO.bat"
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Iniciar Jyy (Servidor + Web + Aplicativo)"
$Shortcut.IconLocation = "shell32.dll,138"
$Shortcut.Save()
Write-Host "Atalho criado com sucesso na Area de Trabalho: $ShortcutPath"
