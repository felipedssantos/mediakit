$ErrorActionPreference = "Stop"

$binDir = Join-Path $PSScriptRoot "..\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$zip = Join-Path $env:TEMP "ffmpeg-essentials.zip"
$dest = Join-Path $env:TEMP "ffmpeg-essentials"

Write-Host "Baixando FFmpeg essentials (gyan.dev)..."
Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $zip -UseBasicParsing

if (Test-Path $dest) {
  Remove-Item $dest -Recurse -Force
}
Expand-Archive -Path $zip -DestinationPath $dest -Force

$ffmpeg = Get-ChildItem -Path $dest -Recurse -Filter ffmpeg.exe | Select-Object -First 1
$ffprobe = Get-ChildItem -Path $dest -Recurse -Filter ffprobe.exe | Select-Object -First 1

if (-not $ffmpeg -or -not $ffprobe) {
  throw "ffmpeg.exe ou ffprobe.exe nao encontrados no arquivo baixado."
}

Copy-Item $ffmpeg.FullName (Join-Path $binDir "ffmpeg-x86_64-pc-windows-msvc.exe") -Force
Copy-Item $ffprobe.FullName (Join-Path $binDir "ffprobe-x86_64-pc-windows-msvc.exe") -Force

Write-Host "Sidecars copiados para src-tauri/binaries/"
Get-ChildItem $binDir | Format-Table Name, Length
