# release.ps1 - Geautomatiseerde release workflow (VEILIGE VERSIE)
# Bron van waarheid: src/listener.py
Write-Host "--- Gridbox Release Script ---" -ForegroundColor Cyan

# 1. Check of er wijzigingen zijn in Git
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "Geen wijzigingen gedetecteerd. Niets om te releasen." -ForegroundColor Yellow
    exit
}

# 2. Lees de versie uit het Python bestand
$pythonFile = "src/listener.py"
if (-not (Test-Path $pythonFile)) {
    Write-Host "Fout: Bestand $pythonFile niet gevonden." -ForegroundColor Red
    exit
}

$content = Get-Content $pythonFile -Raw

# Regex die zoekt naar: VERSION = "1.0.x"
if ($content -match 'VERSION = "(.*)"') {
    $version = $matches[1]
    Write-Host "✅ Gevonden versie in listener.py: $version" -ForegroundColor Green
} else {
    Write-Host "Fout: Kon de variabele VERSION niet vinden in $pythonFile" -ForegroundColor Red
    exit
}

# 3. Vraag bevestiging
$confirm = Read-Host "Klaar om te releasen naar versie $version? (y/n)"
if ($confirm -ne 'y') { 
    Write-Host "Release geannuleerd." -ForegroundColor Yellow
    exit 
}

# 4. Git acties (VEILIG: Voeg alleen expliciete bestanden toe)
Write-Host "Bezig met Git commits..." -ForegroundColor Cyan

# Hier voegen we alleen de bestanden toe die we in Git willen hebben
git add src/listener.py src/db_manager.py .gitignore release.ps1 README.md

git commit -m "Release v$version"
git tag -a "v$version" -m "Release v$version"

# 5. Push naar GitHub
Write-Host "Pushing naar GitHub..." -ForegroundColor Cyan
git push origin main
git push origin "v$version"

Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host "🚀 Versie $version staat live op GitHub!" -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Green