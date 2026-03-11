# START_HIER.ps1 (De "Piet-editie" v1.2)
Clear-Host
$downloadsPath = "$HOME\Downloads\service-account.json"
$localPath = ".\service-account.json"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX CLOUD INSTALLER - PIET METHODE       " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# STAP 1: Slimme Sleutel Controle
Write-Host "🔍 Zoeken naar de digitale sleutel..." -ForegroundColor Gray

if (Test-Path $localPath) {
    $keyPath = $localPath
    Write-Host "✅ Sleutel gevonden in de projectmap." -ForegroundColor Green
}
elseif (Test-Path $downloadsPath) {
    $keyPath = $downloadsPath
    Write-Host "✅ Sleutel gevonden in je Downloads." -ForegroundColor Green
    # Kopieer hem voor de zekerheid naar de projectmap voor later gebruik door de Pi
    Copy-Item $downloadsPath -Destination $localPath
}
else {
    Write-Host "❌ SLEUTEL NIET GEVONDEN!" -ForegroundColor Red
    Write-Host "-------------------------------------------------"
    Write-Host "INSTRUCTIE:" -ForegroundColor Yellow
    Write-Host "1. Vraag het bestand 'service-account.json' aan Piet."
    Write-Host "2. Zet dit bestand in je Downloads-map."
    Write-Host "3. Start dit programma daarna opnieuw op."
    Write-Host "-------------------------------------------------"
    pause
    return
}

# STAP 2: Vragen aan de medewerker
$targetID = Read-Host "`nWelke nieuwe Box ID wil je aanmaken? (bijv. gbox-005)"

# STAP 3: Firestore Klonen
Write-Host "🚀 Firestore configureren voor $targetID..." -ForegroundColor Yellow
$pythonCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account
try:
    creds = service_account.Credentials.from_service_account_file('$($keyPath.Replace('\','\\'))')
    db = firestore.Client(credentials=creds)
    source = db.collection('boxes').document('gbox-004').get().to_dict()
    if source:
        source['software']['currentVersion'] = '1.0.30'
        db.collection('boxes').document('$targetID').set(source)
        print('SUCCESS')
except Exception as e: print(f'ERROR: {e}')
"@
$result = $pythonCode | python
if ($result -match "SUCCESS") { 
    Write-Host "✅ Firestore gereed." -ForegroundColor Green 
} else {
    Write-Host "❌ Firestore fout: $result" -ForegroundColor Red
    pause; return
}

# STAP 4: De SD-Kaart Branden
Write-Host "`n🚀 Start de Raspberry Pi Imager en gebruik deze gegevens:" -ForegroundColor Yellow
Write-Host " - Hostname: $targetID" -ForegroundColor Cyan
Write-Host " - Gebruiker: pi | Wachtwoord: gridbox2026" -ForegroundColor Cyan
Write-Host " - SSH: AAN" -ForegroundColor Cyan
Read-Host "`nDruk op ENTER als de Pi is opgestart en in het stopcontact zit..."

# STAP 5: De Pi configureren
Write-Host "🛰️  Bestanden overzetten naar $targetID.local..." -ForegroundColor Yellow
'{"deviceId": "' + $targetID + '"}' | Out-File -FilePath "box_config.json" -Encoding ascii

scp $localPath pi@$($targetID + ".local"):~/gridbox/platform/service-account.json
scp box_config.json pi@$($targetID + ".local"):~/gridbox/platform/

ssh pi@$($targetID + ".local") "cd ~/gridbox/platform && git fetch origin && git reset --hard origin/main && cp src/listener.py listener.py && sudo systemctl restart gridbox.service"

Write-Host "`n✨ INSTALLATIE VOLTOOID VOOR $targetID!" -ForegroundColor Green
pause
