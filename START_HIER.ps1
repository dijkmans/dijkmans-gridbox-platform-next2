# =========================================
# START_HIER.ps1 v4.0 - De "Master" Editie
# =========================================
Clear-Host

# --- INSTELLINGEN ---
$key = 'service-account.json'
$repo = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'
$piWachtwoord = 'victoria'  # <--- Hier staat je wachtwoord nu centraal!
# --------------------

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '   GRIDBOX MASTER ASSISTENT v4.0         ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

# 1. Controleer de sleutel
if (!(Test-Path $key)) {
    Write-Host "❌ FOUT: $key niet gevonden in deze map!" -ForegroundColor Red
    Write-Host "Zorg dat het Firestore sleutelbestand naast dit script staat." -ForegroundColor Yellow
    pause
    return
}

# 2. Box ID vragen
$id = Read-Host 'Welk nieuwe Box ID wilt u aanmaken? (bijv. gbox-005)'
if ([string]::IsNullOrWhiteSpace($id)) { 
    $id = 'gbox-005'
    Write-Host "Geen invoer herkend. Standaardwaarde '$id' wordt gebruikt." -ForegroundColor Yellow
}

# 3. Firestore vullen (Mal: gbox-004 -> Nieuw: gbox-xxx)
Write-Host "🚀 Cloud configureren: Kopieer gbox-004 naar $id..." -ForegroundColor Yellow

$pyCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account

try:
    c = service_account.Credentials.from_service_account_file('$key')
    db = firestore.Client(credentials=c)
    
    doc_ref = db.collection('boxes').document('gbox-004').get()
    if not doc_ref.exists:
        print('FOUT_MAL_ONTBREEKT')
        sys.exit()
        
    s = doc_ref.to_dict()
    s['software'] = {'currentVersion':'1.0.30'}
    
    db.collection('boxes').document('$id').set(s)
    print('PYTHON_SUCCESS')
except Exception as e:
    print(f'PYTHON_FOUT: {e}')
"@

$res = python -c $pyCode

if ($res -match 'PYTHON_SUCCESS') {
    Write-Host "✅ Cloud koppeling gelukt! Instellingen gekopieerd naar $id." -ForegroundColor Green
} else {
    Write-Host "❌ Fout in Cloud: $res" -ForegroundColor Red
    pause
    return
}

# 4. Bestanden binnenhalen of verversen
Write-Host '📦 Bestanden synchroniseren...' -ForegroundColor Gray
if (!(Test-Path '.git')) {
    git init
    git remote add origin $repo
    git fetch origin
    git checkout -t origin/main -f
} else {
    git fetch origin
    git reset --hard origin/main
}

# 5. AUTOMATISCHE SD-KAART CONFIGURATIE
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host " ✨ ALLES IS KLAAR VOOR DE START!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Steek nu een SD kaartje in de kaartlezer van je PC." -ForegroundColor Yellow
pause

$Drive = Read-Host "Welke schijfletter heeft de SD-kaart gekregen? (Bijv. D, E of F)"

# Veiligheidscheck 1: Pak alleen de eerste letter en maak er een hoofdletter van
if (![string]::IsNullOrWhiteSpace($Drive)) {
    $Drive = $Drive.Substring(0,1).ToUpper()
}

# Veiligheidscheck 2: Is het de C-schijf? (Voorkomt crashen van de Windows PC)
if ($Drive -eq 'C') {
    Write-Host "❌ FOUT: Je kunt je Windows C-schijf niet overschrijven! Script afgebroken." -ForegroundColor Red
    pause
    return
}

# Veiligheidscheck 3: Bestaat de schijf en is het een verwisselbare USB/SD kaart?
$Volume = Get-Volume -DriveLetter $Drive -ErrorAction SilentlyContinue
if (!$Volume -or $Volume.DriveType -ne 'Removable') {
    Write-Host "❌ FOUT: Schijf $Drive: is niet gevonden of is geen verwisselbare SD-kaart! Controleer de letter." -ForegroundColor Red
    pause
    return
}

Write-Host "✅ Veilige SD-kaart gedetecteerd op schijf $Drive:!" -ForegroundColor Green

# Start Raspberry Pi Imager automatisch op
$ImagerPath = "C:\Program Files\Raspberry Pi\Imager\rpi-imager.exe"

if (Test-Path $ImagerPath) {
    Write-Host "`n-------------------------------------------------"
    Write-Host "Raspberry Pi Imager opent nu automatisch."
    Write-Host "Vul bij de instellingen (OS Customisation) het volgende in:"
    Write-Host "1. Hostname: $id" -ForegroundColor White
    Write-Host "2. User: pi  |  Pass: $piWachtwoord" -ForegroundColor White
    Write-Host "3. Zet SSH AAN." -ForegroundColor White
    Write-Host "-------------------------------------------------"
    Start-Process $ImagerPath
} else {
    Write-Host "❌ Raspberry Pi Imager is niet gevonden op de standaardlocatie. Installeer deze eerst op de PC." -ForegroundColor Red
}

Write-Host "`nDruk op Enter om dit venster te sluiten..."
pause
