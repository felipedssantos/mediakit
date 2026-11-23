$ErrorActionPreference = "Stop"

$version = "9.1"
$expectedSha256 = "b9bbbb3acece000cbeec994f856649354e52c773807841e78908374b24d658fd"
$url = "https://github.com/GyanD/codexffmpeg/releases/download/$version/ffmpeg-$version-essentials_build.zip"

$binDir = Join-Path $PSScriptRoot "..\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$zip = Join-Path $env:TEMP "ffmpeg-$version-essentials.zip"
$dest = Join-Path $env:TEMP "ffmpeg-$version-essentials"

Write-Host "Baixando FFmpeg $version essentials (GyanD/codexffmpeg)..."
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

$actualSha256 = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  throw "Falha na verificacao SHA-256 do FFmpeg. Esperado: $expectedSha256, obtido: $actualSha256"
}
Write-Host "SHA-256 verificado: $actualSha256"

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

Write-Host "Sidecars FFmpeg $version copiados para src-tauri/binaries/"
Get-ChildItem $binDir | Format-Table Name, Length
