# =========================================================
# START_HIER.ps1 v4.3 - TURBO MASTER EDITIE
# =========================================================
Clear-Host

# --- INSTELLINGEN ---
$key = 'service-account.json'
$repo = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'
$piWachtwoord = 'victoria'
$huidigeVersie = '1.0.31'
# --------------------

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '    GRIDBOX MASTER ASSISTENT v4.3        ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

# 1. Controleer de sleutel
if (!(Test-Path $key)) {
    Write-Host "[FOUT]: $key niet gevonden! Zorg dat deze in de map staat." -ForegroundColor Red
    pause
    return
}

# 2. Box ID vragen
$id = Read-Host "Welk nieuwe Box ID wilt u aanmaken? (bijv. gbox-005)"
if ([string]::IsNullOrWhiteSpace($id)) { $id = 'gbox-005' }

# 3. Firestore vullen (Kopieer gbox-004 als mal)
Write-Host "[START] Cloud configureren: Kopieer gbox-004 naar $id..." -ForegroundColor Yellow

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
    s['software'] = {
        'currentVersion': '$huidigeVersie',
        'status': 'new_install',
        'piModel': 'Pending...'
    }
    
    db.collection('boxes').document('$id').set(s)
    print('PYTHON_SUCCESS')
except Exception as e:
    print(f'PYTHON_FOUT: {e}')
"@

$res = python -c $pyCode

if ($res -match 'PYTHON_SUCCESS') {
    Write-Host "[OK] Cloud koppeling gelukt voor $id!" -ForegroundColor Green
} else {
    Write-Host "[FOUT] in Cloud: $res" -ForegroundColor Red
    pause
    return
}

# 4. Bestanden synchroniseren met GitHub
Write-Host '[SYNC] Bestanden synchroniseren met GitHub...' -ForegroundColor Gray
if (!(Test-Path '.git')) {
    git init | Out-Null
    git remote add origin $repo
    git fetch origin | Out-Null
    git checkout -t origin/main -f | Out-Null
} else {
    git fetch origin | Out-Null
    git reset --hard origin/main | Out-Null
}

# 5. STAP 1: SD-KAART BRANDEN
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host " [STAP 1/2] SD-KAART BRANDEN" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "1. Steek de SD-kaart in de PC." -ForegroundColor Yellow
Write-Host "2. De Imager opent nu automatisch." -ForegroundColor Yellow
Write-Host "3. KIES OS: Raspberry Pi OS (64-bit) Lite." -ForegroundColor White
Write-Host "4. GEBRUIK HET TANDWIEL (OS Customisation):" -ForegroundColor White
Write-Host "   - Hostname: $id" -ForegroundColor Green
Write-Host "   - Gebruiker: pi | Wachtwoord: $piWachtwoord" -ForegroundColor Green
Write-Host "   - SSH: AANVINKEN bij Services" -ForegroundColor Green
Write-Host "5. KLIK OP SCHRIJVEN EN WACHT TOT HIJ KLAAR IS." -ForegroundColor Red
pause

# Zoek en start Imager
$ZoekPaden = @("$env:ProgramFiles\Raspberry Pi\Imager\rpi-imager.exe", "${env:ProgramFiles(x86)}\Raspberry Pi\Imager\rpi-imager.exe")
$ImagerPath = $ZoekPaden | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($ImagerPath) {
    Start-Process $ImagerPath -Wait
} else {
    Write-Host "[INFO] Imager niet gevonden in standaardpaden. Open deze handmatig." -ForegroundColor Yellow
    pause
}

# 6. STAP 2: AUTO-DETECT & CONFIG INJECTIE
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host " [STAP 2/2] AUTOMATISCHE CONFIGURATIE" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "[ZOEKEN] Zoeken naar de vers gebrande SD-kaart..." -ForegroundColor Gray

# Zoek een schijf kleiner dan 65GB met label 'boot' of 'bootfs'
$SDCard = Get-Volume | Where-Object { 
    ($_.FileSystemLabel -match "boot" -or $_.FileSystemLabel -match "bootfs") -and 
    $_.DriveType -eq 'Removable' -and
    $_.Size -lt 65GB 
} | Select-Object -First 1

if ($SDCard) {
    $DriveLetter = $SDCard.DriveLetter
    $Drive = $DriveLetter + ":"
    Write-Host "[GEREED] SD-kaart gevonden op station $Drive ($($SDCard.FileSystemLabel))" -ForegroundColor Cyan
    $Bevestig = Read-Host "Is dit de juiste schijf? (Druk op ENTER voor JA, typ 'N' voor handmatig)"
    
    if ($Bevestig -eq 'N') {
        $ManueleLetter = Read-Host "Voer de juiste schijfletter in (Bijv. G)"
        $Drive = $ManueleLetter.Substring(0,1).ToUpper() + ":"
    }
} else {
    Write-Host "[WAARSCHUWING] Geen SD-kaart automatisch herkend." -ForegroundColor Yellow
    $ManueleLetter = Read-Host "Welke schijfletter heeft de SD-kaart? (Bijv. F)"
    $Drive = $ManueleLetter.Substring(0,1).ToUpper() + ":"
}

# Definitieve Injectie
if (Test-Path $Drive) {
    Write-Host "[CONFIG] Bestanden kopiëren naar $Drive..." -ForegroundColor Yellow
    
    # 1. Maak de box_config.json
    $configJson = '{"deviceId": "' + $id + '"}'
    $configJson | Set-Content -Path "$Drive\box_config.json" -Encoding Ascii
    
    # 2. Kopieer de cloud-sleutel
    Copy-Item $key -Destination "$Drive\service-account.json" -Force
    
    # 3. Extra SSH-activatie check (maakt leeg bestandje 'ssh')
    New-Item -Path "$Drive\ssh" -ItemType File -Force | Out-Null
    
    Write-Host "[OK] Configuratie voor $id succesvol geïnjecteerd!" -ForegroundColor Green
} else {
    Write-Host "[FOUT] Schijf $Drive is niet bereikbaar. Doe de injectie handmatig!" -ForegroundColor Red
}

Write-Host "`n🚀 ALLES KLAAR! Steek de kaart in de Pi en zet hem aan." -ForegroundColor Cyan
Write-Host "Wacht 2 minuten en probeer daarna: ssh pi@$id.local" -ForegroundColor Gray
pause