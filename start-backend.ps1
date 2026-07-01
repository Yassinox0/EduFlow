param(
    [string]$BindAddress = '127.0.0.1',
    [int]$Port = 8080
)

$php = 'C:\xampp\php\php.exe'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot 'backend'
$publicDir = Join-Path $backendDir 'public'

if (-not (Test-Path $php)) {
    Write-Error "PHP introuvable: $php"
    exit 1
}

if (-not (Test-Path $publicDir)) {
    Write-Error "Dossier public introuvable: $publicDir"
    exit 1
}

Set-Location $backendDir
& $php -S "$BindAddress`:$Port" -t $publicDir (Join-Path $publicDir 'index.php')
