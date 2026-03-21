$downloadPath = Join-Path $HOME "Downloads\gridbox-project-docs"
New-Item -ItemType Directory -Force -Path $downloadPath | Out-Null

Remove-Item "$downloadPath\*.md" -Force -ErrorAction SilentlyContinue

$files = @(
    @{ Source = ".\README.md"; Target = "README.md" },
    @{ Source = ".\docs\01_MASTER_CONTEXT.md"; Target = "01_MASTER_CONTEXT.md" },
    @{ Source = ".\docs\02_ARCHITECTURE_AND_SCHEMA.md"; Target = "02_ARCHITECTURE_AND_SCHEMA.md" },
    @{ Source = ".\docs\03_DECISIONS_LOG.md"; Target = "03_DECISIONS_LOG.md" },
    @{ Source = ".\docs\04_CURRENT_WORKSTATE.md"; Target = "04_CURRENT_WORKSTATE.md" },
    @{ Source = ".\LEGACY_ROOT_NOTE.md"; Target = "LEGACY_ROOT_NOTE.md" }
)

Write-Host "Syncen van project documenten..." -ForegroundColor Cyan

foreach ($file in $files) {
    if (Test-Path $file.Source) {
        Copy-Item $file.Source -Destination (Join-Path $downloadPath $file.Target) -Force
        Write-Host "OK  $($file.Target)" -ForegroundColor Green
    } else {
        Write-Host "NIET GEVONDEN  $($file.Source)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Klaar. Upload deze map in je ChatGPT-project:" -ForegroundColor Yellow
Write-Host $downloadPath -ForegroundColor White

Get-ChildItem $downloadPath | Select-Object Name, Length, LastWriteTime
