$ErrorActionPreference = "Stop"

$version = "2026.10.26"
$expectedSha256 = "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d"
$url = "https://github.com/yt-dlp/yt-dlp/releases/download/$version/yt-dlp.exe"

$binDir = Join-Path $PSScriptRoot "..\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$tmp = Join-Path $env:TEMP "yt-dlp-$version.exe"
$dest = Join-Path $binDir "yt-dlp-x86_64-pc-windows-msvc.exe"

Write-Host "Baixando yt-dlp $version..."
Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing

$actualSha256 = (Get-FileHash -Path $tmp -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  throw "Falha na verificacao SHA-256 do yt-dlp. Esperado: $expectedSha256, obtido: $actualSha256"
}
Write-Host "SHA-256 verificado: $actualSha256"

Move-Item -Path $tmp -Destination $dest -Force
Write-Host "Sidecar yt-dlp $version copiado para src-tauri/binaries/"
Get-Item $dest | Format-Table Name, Length
