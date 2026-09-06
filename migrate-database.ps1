param(
    [switch]$Status
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationRunner = Join-Path $projectRoot 'backend\bin\migrate.php'

$phpCommand = Get-Command php -ErrorAction SilentlyContinue

if ($null -ne $phpCommand) {
    $phpExecutable = $phpCommand.Source
} elseif (Test-Path -LiteralPath 'C:\xampp\php\php.exe') {
    $phpExecutable = 'C:\xampp\php\php.exe'
} else {
    throw 'PHP was not found. Add PHP to PATH or install it under C:\xampp\php.'
}

$migrationArguments = @($migrationRunner)

if ($Status) {
    $migrationArguments += '--status'
}

& $phpExecutable @migrationArguments
exit $LASTEXITCODE
