$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "vendor\musclemap-src\src\index.ts"
$output = Join-Path $root "js\vendor\musclemap\musclemap.js"

if (!(Test-Path $source)) {
    throw "Source MuscleMapJS introuvable : $source"
}

npx esbuild "$source" --bundle --format=esm --platform=browser --target=es2020 "--outfile=$output"

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "MuscleMapJS compilé avec succès."