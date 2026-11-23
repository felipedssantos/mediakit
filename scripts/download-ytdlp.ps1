$ErrorActionPreference = "Stop"

$binDir = Join-Path $PSScriptRoot "..\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$dest = Join-Path $binDir "yt-dlp-x86_64-pc-windows-msvc.exe"
Write-Host "Baixando yt-dlp..."
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $dest -UseBasicParsing

Write-Host "Sidecar copiado para src-tauri/binaries/"
Get-Item $dest | Format-Table Name, Length
