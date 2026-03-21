# release.ps1 - Listener / Raspberry Pi release script
# BELANGRIJK:
# Dit script is GEEN algemeen release-script voor het volledige Gridbox-platform.
# Dit script is alleen bedoeld voor de releaseflow van de Python listener-laag in /src.
# Officiële architectuur:
# - frontend = gridbox-portal
# - backend = gridbox-api
# - device = src
# Gebruik dit script dus niet als algemene release voor portal of API.

Write-Host "--- Gridbox Listener Release Script ---" -ForegroundColor Cyan

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
    Write-Host "Gevonden versie in listener.py: $version" -ForegroundColor Green
} else {
    Write-Host "Fout: Kon de variabele VERSION niet vinden in $pythonFile" -ForegroundColor Red
    exit
}

# 3. Vraag bevestiging
$confirm = Read-Host "Klaar om listener release v$version te maken? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Release geannuleerd." -ForegroundColor Yellow
    exit
}

# 4. Git acties
Write-Host "Bezig met Git commits..." -ForegroundColor Cyan

git add src/listener.py src/db_manager.py .gitignore release.ps1 README.md
git commit -m "Release listener v$version"
git tag -a "v$version" -m "Release listener v$version"

# 5. Push naar GitHub
Write-Host "Pushing naar GitHub..." -ForegroundColor Cyan
git push origin main
git push origin "v$version"

Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host "Listener versie $version staat live op GitHub." -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Green
