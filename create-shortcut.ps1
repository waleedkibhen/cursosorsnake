# Create system-wide project launcher
$scriptPath = "$env:USERPROFILE\ProjectLauncher"
$launcherPath = "$scriptPath\project-launcher.ps1"

# Create directory if it doesn't exist
if (-not (Test-Path $scriptPath)) {
    New-Item -ItemType Directory -Path $scriptPath
}

# Copy the launcher script
Copy-Item "project-launcher.ps1" -Destination $launcherPath

# Create shortcut on desktop
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Launch Project.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$launcherPath`""
$Shortcut.WorkingDirectory = "%CD%"
$Shortcut.IconLocation = "shell32.dll,41"
$Shortcut.Save()

Write-Host "✨ Setup Complete!" -ForegroundColor Green
Write-Host "A 'Launch Project' shortcut has been created on your desktop." -ForegroundColor Yellow
Write-Host "Just copy this shortcut to any project folder and double-click to launch!" -ForegroundColor Cyan 