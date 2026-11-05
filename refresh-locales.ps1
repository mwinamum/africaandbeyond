param([string]$WorkDirectory = (Join-Path $PSScriptRoot 'work'))

$ErrorActionPreference = 'Stop'
$translationWork = [System.IO.Path]::GetFullPath($WorkDirectory)
$translationPython = Join-Path $translationWork 'translate-env/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $translationPython)) {
    throw 'The local translation environment is missing. Install the Argos engine before refreshing languages.'
}
Push-Location $PSScriptRoot
$previousWorkDirectory = $env:SAFARI_WORK_DIR
try {
    $env:SAFARI_WORK_DIR = $translationWork
    node prepare-translation-input.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Could not fetch the current tour catalogue.' }
    & $translationPython generate-locales.py --languages all
    if ($LASTEXITCODE -ne 0) { throw 'Some language batches need a retry. Completed languages remain available.' }
} finally {
    $env:SAFARI_WORK_DIR = $previousWorkDirectory
    Pop-Location
}
