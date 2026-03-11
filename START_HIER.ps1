# START_HIER.ps1 (De Standalone Versie)
Clear-Host
$repoUrl = "https://raw.githubusercontent.com/piet/dijkmans-gridbox-platform-next2/main"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX CLOUD INSTALLER v1.1                 " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# STAP 1: Sleutel controle
if (!(Test-Path "service-account.json")) {
    Write-Host "⚠️  Sleutelbestand niet gevonden in de huidige map!" -ForegroundColor Yellow
    Write-Host "Sleep het bestand 'service-account.json' nu in deze map en druk op ENTER."
    Read-Host
    if (!(Test-Path "service-account.json")) { Write-Error "Geen sleutel, geen installatie. Gestopt."; return }
}

# STAP 2: Vragen aan de medewerker
$targetID = Read-Host "Welke nieuwe Box ID wil je aanmaken? (bijv. gbox-005)"

# STAP 3: Firestore Klonen
Write-Host "🚀 Firestore configureren voor $targetID..." -ForegroundColor Yellow
$pythonCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account
try:
    creds = service_account.Credentials.from_service_account_file('service-account.json')
    db = firestore.Client(credentials=creds)
    source = db.collection('boxes').document('gbox-004').get().to_dict()
    if source:
        source['software']['currentVersion'] = '1.0.30'
        db.collection('boxes').document('$targetID').set(source)
        print('SUCCESS')
except Exception as e: print(e)
"@
$result = $pythonCode | python
if ($result -match "SUCCESS") { Write-Host "✅ Firestore gereed." -ForegroundColor Green }

# STAP 4: De SD-Kaart
Write-Host "`n🚀 Start de Raspberry Pi Imager en gebruik deze gegevens:" -ForegroundColor Yellow
Write-Host " - Hostname: $targetID" -ForegroundColor Cyan
Write-Host " - User: pi | Pass: gridbox2026" -ForegroundColor Cyan
Read-Host "`nDruk op ENTER als de Pi is opgestart en verbonden met internet..."

# STAP 5: De Pi 'Afschieten'
Write-Host "🛰️  Verbinding maken met $targetID.local..." -ForegroundColor Yellow
'{"deviceId": "' + $targetID + '"}' | Out-File -FilePath "box_config.json" -Encoding ascii

scp service-account.json pi@$($targetID + ".local"):~/gridbox/platform/
scp box_config.json pi@$($targetID + ".local"):~/gridbox/platform/

ssh pi@$($targetID + ".local") "cd ~/gridbox/platform && git fetch origin && git reset --hard origin/main && cp src/listener.py listener.py && sudo systemctl restart gridbox.service"

Write-Host "`n✨ INSTALLATIE VOLTOOID!" -ForegroundColor Green