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
    pause
    return
}

# 2. Box ID vragen
$id = Read-Host 'Welk nieuwe Box ID wilt u aanmaken? (bijv. gbox-005)'
if ([string]::IsNullOrWhiteSpace($id)) { 
    $id = 'gbox-005'
}

# 3. Firestore vullen
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
    Write-Host "✅ Cloud koppeling gelukt!" -ForegroundColor Green
} else {
    Write-Host "❌ Fout in Cloud: $res" -ForegroundColor Red
    pause
    return
}

# 4. Bestanden synchroniseren
Write-Host '📦 Bestanden synchroniseren...' -ForegroundColor Gray
if (!(Test-Path '.git')) {
    git init | Out-Null
    git remote add origin $repo
    git fetch origin | Out-Null
    git checkout -t origin/main -f | Out-Null
} else {
    git fetch origin | Out-Null
    git reset --hard origin/main | Out-Null
}

# 5. AUTOMATISCHE SD-KAART CONFIGURATIE
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host " ✨ ALLES IS KLAAR VOOR DE START!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Steek nu een SD kaartje in de kaartlezer van je PC." -ForegroundColor Yellow
pause

$Drive = Read-Host "Welke schijfletter heeft de SD-kaart gekregen? (Bijv. D, E of F)"

if (![string]::IsNullOrWhiteSpace($Drive)) {
    $Drive = $Drive.Substring(0,1).ToUpper()
}

if ($Drive -eq 'C') {
    Write-Host "❌ FOUT: Je kunt je Windows C-schijf niet overschrijven! Script afgebroken." -ForegroundColor Red
    pause
    return
}

$Volume = Get-Volume -DriveLetter $Drive -ErrorAction SilentlyContinue
if (!$Volume -or $Volume.DriveType -ne 'Removable') {
    Write-Host "❌ FOUT: Schijf $Drive is niet gevonden of is geen verwisselbare SD-kaart!" -ForegroundColor Red
    pause
    return
}

Write-Host "✅ Veilige SD-kaart gedetecteerd op schijf $Drive!" -ForegroundColor Green

# 6. SLIM ZOEKEN NAAR RASPBERRY PI IMAGER
$ZoekPaden = @(
    "$env:ProgramFiles\Raspberry Pi\Imager\rpi-imager.exe",
    "${env:ProgramFiles(x86)}\Raspberry Pi\Imager\rpi-imager.exe"
)

# Zoek het eerste pad dat daadwerkelijk bestaat op deze PC
$ImagerPath = $ZoekPaden | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($ImagerPath) {
    Write-Host "`n-------------------------------------------------"
    Write-Host "Raspberry Pi Imager opent nu automatisch."
    Write-Host "Vul bij de instellingen (OS Customisation) het volgende in:"
    Write-Host "1. Hostname: $id" -ForegroundColor White
    Write-Host "2. User: pi  |  Pass: $piWachtwoord" -ForegroundColor White
    Write-Host "3. Zet SSH AAN." -ForegroundColor White
    Write-Host "-------------------------------------------------"
    Start-Process $ImagerPath
} else {
    # Als hij het écht niet kan vinden op de standaard plekken, gebruiken we een Windows fallback
    Write-Host "ℹ️ We proberen de Imager via Windows te openen..." -ForegroundColor Yellow
    try {
        Start-Process "rpi-imager" -ErrorAction Stop
    } catch {
        Write-Host "❌ Imager niet gevonden. Open deze handmatig via je Start-menu." -ForegroundColor Red
    }
}

pause
