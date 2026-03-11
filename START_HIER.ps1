# START_HIER.ps1 (v1.3 - De "Single File" Piet-Editie)
Clear-Host
$repoUrl = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"
$downloadsPath = "$HOME\Downloads\service-account.json"
$localKey = ".\service-account.json"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX EEN-KLIK INSTALLER v1.3              " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# STAP 1: De Sleutel-Check (Piet-Methode)
if (Test-Path $downloadsPath) {
    Write-Host "✅ Sleutel gevonden in Downloads. Ik kopieer hem..." -ForegroundColor Green
    Copy-Item $downloadsPath -Destination $localKey -Force
} elseif (-not (Test-Path $localKey)) {
    Write-Host "❌ SLEUTEL NIET GEVONDEN!" -ForegroundColor Red
    Write-Host "Zet 'service-account.json' (van Piet) in je Downloads map." -ForegroundColor Yellow
    pause; return
}

# STAP 2: Zelf-Update (Haal de nieuwste src/ map op)
Write-Host "📦 Nieuwste bestanden ophalen van GitHub..." -ForegroundColor Gray
if (-not (Test-Path ".git")) {
    # Als we nog niet in een git-map zitten, initialiseer en haal op
    git clone $repoUrl .
} else {
    # Als we er al zijn, ververs alles naar de laatste versie
    git fetch origin
    git reset --hard origin/main
}

# STAP 3: De Installatie-vragen
$targetID = Read-Host "`nWelke nieuwe Box ID wil je aanmaken? (bijv. gbox-005)"

# STAP 4: Firestore Klonen via Python
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
except Exception as e: print(f'ERROR: {e}')
"@
$result = $pythonCode | python
if ($result -match "SUCCESS") { Write-Host "✅ Firestore gereed." -ForegroundColor Green } 
else { Write-Host "❌ Fout: $result" -ForegroundColor Red; pause; return }

# STAP 5: De rest van de Pi-procedure (Imager & SCP)
Write-Host "`n🚀 Start de Raspberry Pi Imager:" -ForegroundColor Yellow
Write-Host " - Hostname: $targetID | User: pi | Pass: gridbox2026 | SSH: AAN" -ForegroundColor Cyan
Read-Host "`nDruk op ENTER als de Pi aan staat..."

# Box config maken en versturen
'{"deviceId": "' + $targetID + '"}' | Out-File -FilePath "box_config.json" -Encoding ascii
scp service-account.json box_config.json pi@$($targetID + ".local"):~/gridbox/platform/
ssh pi@$($targetID + ".local") "sudo systemctl restart gridbox.service"

Write-Host "`n✨ KLAAR! Box $targetID is nu een kopie van 004." -ForegroundColor Green
pause
