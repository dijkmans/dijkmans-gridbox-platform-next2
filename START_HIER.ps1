# START_HIER.ps1 (v1.3 - De "Single File" Piet-Editie)
Clear-Host
$repoUrl = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"
$keyPath = "$HOME\Downloads\service-account.json"
$localKey = ".\service-account.json"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX EEN-KLIK INSTALLER v1.3              " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# STAP 1: De Sleutel-Check
if (Test-Path $keyPath) {
    Write-Host "✅ Sleutel gevonden in Downloads. Ik kopieer hem..." -ForegroundColor Green
    Copy-Item $keyPath -Destination $localKey -Force
} elseif (-not (Test-Path $localKey)) {
    Write-Host "❌ SLEUTEL NIET GEVONDEN in Downloads!" -ForegroundColor Red
    pause; return
}

# STAP 2: Onderdelen ophalen
Write-Host "📦 Nieuwste onderdelen ophalen van GitHub..." -ForegroundColor Gray
if (-not (Test-Path ".git")) {
    git clone $repoUrl .
} else {
    git fetch origin; git reset --hard origin/main
}

# STAP 3: De Vraag
$targetID = Read-Host "`nWelke nieuwe Box ID wil je aanmaken? (bijv. gbox-005)"

# STAP 4: De Python Actie (Dit moet zo blijven staan!)
$pythonCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account
try:
    creds = service_account.Credentials.from_service_account_file('service-account.json')
    db = firestore.Client(credentials=creds)
    source = db.collection('boxes').document('gbox-004').get().to_dict()
    if source:
        db.collection('boxes').document('$targetID').set(source)
        print('SUCCESS')
except Exception as e: print(f'ERROR: {e}')
"@
$result = $pythonCode | python
if ($result -contains "SUCCESS") { Write-Host "✅ Cloud gereed." -ForegroundColor Green }

Write-Host "`n🚀 KLAAR! Je kunt nu de Imager gebruiken." -ForegroundColor Green
pause