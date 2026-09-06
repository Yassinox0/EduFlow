$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$demoSeeder = Join-Path $projectRoot 'backend\bin\seed-demo.php'
$phpCommand = Get-Command php -ErrorAction SilentlyContinue

if ($null -ne $phpCommand) {
    $phpExecutable = $phpCommand.Source
} elseif (Test-Path -LiteralPath 'C:\xampp\php\php.exe') {
    $phpExecutable = 'C:\xampp\php\php.exe'
} else {
    throw 'PHP was not found. Add PHP to PATH or install it under C:\xampp\php.'
}

& $phpExecutable $demoSeeder
exit $LASTEXITCODE
