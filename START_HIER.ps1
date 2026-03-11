# START_HIER.ps1 (v1.4 - De "Gouden" Piet-Editie)
# Deze versie is geoptimaliseerd voor Windows PowerShell en voorkomt Python-conflicten.

Clear-Host
$repoUrl = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"
$downloadsPath = "$HOME\Downloads\service-account.json"
$localKey = ".\service-account.json"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "    GRIDBOX EEN-KLIK INSTALLER v1.4              " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# STAP 1: De Sleutel-Check
if (Test-Path $downloadsPath) {
    Write-Host "[+] Sleutel gevonden in Downloads. Kopieren..." -ForegroundColor Green
    Copy-Item $downloadsPath -Destination $localKey -Force
} elseif (-not (Test-Path $localKey)) {
    Write-Host "[!] SLEUTEL NIET GEVONDEN!" -ForegroundColor Red
    Write-Host "Zet 'service-account.json' in je Downloads map." -ForegroundColor Yellow
    pause; return
}

# STAP 2: Onderdelen ophalen van GitHub
Write-Host "[+] Bestanden controleren..." -ForegroundColor Gray
if (-not (Test-Path ".git")) {
    git clone $repoUrl .
} else {
    git fetch origin; git reset --hard origin/main
}

# STAP 3: De Box ID vraag
$targetID = Read-Host "`nWelke nieuwe Box ID wil je aanmaken? (bijv. gbox-005)"

# STAP 4: Firestore Klonen via Python (geisoleerd)
Write-Host "[+] Cloud configureren voor $targetID..." -ForegroundColor Yellow
$pythonScript = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account
try:
    creds = service_account.Credentials.from_service_account_file('service-account.json')
    db = firestore.Client(credentials=creds)
    source_doc = db.collection('boxes').document('gbox-004').get()
    if source_doc.exists:
        data = source_doc.to_dict()
        data['software'] = data.get('software', {})
        data['software']['currentVersion'] = '1.0.30'
        db.collection('boxes').document('$targetID').set(data)
        print('PYTHON_SUCCESS')
    else:
        print('ERROR: Bron gbox-004 niet gevonden')
except Exception as e:
    print(f'ERROR: {e}')
"@

$result = $pythonScript | python
if ($result -match "PYTHON_SUCCESS") { 
    Write-Host "[+] Cloud gereed: Box $targetID aangemaakt." -ForegroundColor Green 
} else { 
    Write-Host "[!] Fout bij cloud-configuratie: $result" -ForegroundColor Red
    pause; return 
}

# STAP 5: Imager & Voorbereiding
Write-Host "`n[!] START NU DE RASPBERRY PI IMAGER:" -ForegroundColor Yellow
Write-Host "-------------------------------------------------"
Write-Host " Hostname: $targetID" -ForegroundColor White
Write-Host " Gebruiker: pi | Wachtwoord: gridbox2026" -ForegroundColor White
Write-Host " SSH: Moet op AAN staan" -ForegroundColor White
Write-Host "-------------------------------------------------"
Read-Host "Druk op ENTER als de Pi opgestart is en in het netwerk zit..."

# Box config bestandje maken
$configJson = '{"deviceId": "' + $targetID + '"}'
$configJson | Out-File -FilePath "box_config.json" -Encoding ascii

# Bestanden overzetten naar de Pi
Write-Host "[+] Bestanden versturen naar de Pi..." -ForegroundColor Gray
scp service-account.json box_config.json pi@$($targetID + ".local"):~/gridbox/platform/

# Herstart de service op de Pi
Write-Host "[+] Service herstarten..." -ForegroundColor Gray
ssh pi@$($targetID + ".local") "sudo systemctl restart gridbox.service"

Write-Host "`n[***] INSTALLATIE VOLTOOID! Box $targetID is live. [***]" -ForegroundColor Green
pause
