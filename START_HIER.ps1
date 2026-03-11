# START_HIER.ps1 v4.0 - De "Master" Editie
Clear-Host
$key = 'service-account.json'
$repo = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '   GRIDBOX MASTER ASSISTENT v4.0         ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

# 1. Controleer de sleutel
if (!(Test-Path $k)) {
    Write-Host '❌ FOUT: service-account.json niet gevonden!' -ForegroundColor Red
    return
}

# 2. Box ID vragen
$id = Read-Host 'Welk nieuwe Box ID wilt u aanmaken? (bijv. gbox-005)'
if (!$id) { $id = 'gbox-005' }

# 3. Firestore vullen (Mal: gbox-004 -> Nieuw: gbox-xxx)
Write-Host "🚀 Cloud configureren: Kopieer gbox-004 naar $id..." -ForegroundColor Yellow

# Deze Python code is nu extra veilig met quotes rondom alle variabelen
$pyCode = "import sys; from google.cloud import firestore; from google.oauth2 import service_account; " + `
"c=service_account.Credentials.from_service_account_file('$key'); " + `
"db=firestore.Client(credentials=c); " + `
"s=db.collection('boxes').document('gbox-004').get().to_dict(); " + `
"s['software']={'currentVersion':'1.0.30'}; " + `
"db.collection('boxes').document('$id').set(s); print('PYTHON_SUCCESS')"

$res = python -c $pyCode

if ($res -match 'PYTHON_SUCCESS') {
    Write-Host '✅ Cloud koppeling gelukt! gbox-004 is gekopieerd.' -ForegroundColor Green
} else {
    Write-Host "❌ Fout in Cloud: $res" -ForegroundColor Red
    return
}

# 4. Bestanden binnenhalen of verversen
Write-Host '📦 Bestanden synchroniseren...' -ForegroundColor Gray
if (!(Test-Path '.git')) {
    git clone $repo .
} else {
    git fetch origin
    git reset --hard origin/main
}

Write-Host "`n✨ ALLES IS KLAAR VOOR DE START!" -ForegroundColor Green
Write-Host "-------------------------------------------------"
Write-Host "1. Open Raspberry Pi Imager."
Write-Host "2. Gebruik Hostname: $id" -ForegroundColor White
Write-Host "3. Gebruik User: pi | Pass: gridbox2026" -ForegroundColor White
Write-Host "4. Zet SSH AAN."
Write-Host "-------------------------------------------------"
pause
