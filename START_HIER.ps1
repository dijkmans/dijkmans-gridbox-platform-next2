# START_HIER.ps1 v4.1 - De "Master" Fix
Clear-Host
$k = 'service-account.json'
$repo = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '   GRIDBOX MASTER ASSISTENT v4.1         ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

# 1. Controleer de sleutel (Nu met de juiste variabele $k)
if (!(Test-Path $k)) {
    Write-Host "❌ FOUT: $k niet gevonden in Downloads!" -ForegroundColor Red
    return
}

# 2. Box ID vragen
$id = Read-Host 'Welk nieuwe Box ID wilt u aanmaken? (bijv. gbox-005)'
if (!$id) { $id = 'gbox-005' }

# 3. Firestore vullen (Mal: gbox-004 -> Nieuw: gbox-xxx)
Write-Host "🚀 Cloud configureren: Kopieer gbox-004 naar $id..." -ForegroundColor Yellow

# We maken de Python-code nu super-robuust met extra aanhalingstekens
$pyCode = "import sys; from google.cloud import firestore; from google.oauth2 import service_account; " + `
"c=service_account.Credentials.from_service_account_file('$k'); " + `
"db=firestore.Client(credentials=c); " + `
"s=db.collection('boxes').document('gbox-004').get().to_dict(); " + `
"s['software']={'currentVersion':'1.0.30'}; " + `
"db.collection('boxes').document('$id').set(s); print('PYTHON_SUCCESS')"

$res = python -c $pyCode

if ($res -match 'PYTHON_SUCCESS') {
    Write-Host '✅ Cloud koppeling gelukt!' -ForegroundColor Green
} else {
    Write-Host "❌ Fout in Cloud: $res" -ForegroundColor Red
    return
}

# 4. Bestanden synchroniseren
Write-Host '📦 Bestanden synchroniseren...' -ForegroundColor Gray
if (!(Test-Path '.git')) {
    # Als de map niet leeg is maar ook geen git is, ruimen we hem op
    git clone $repo temp_git
    Move-Item temp_git\* . -Force
    Remove-Item temp_git -Recurse -Force
} else {
    git fetch origin
    git reset --hard origin/main
}

Write-Host "`n✨ KLAAR VOOR DE START!" -ForegroundColor Green
Write-Host "-------------------------------------------------"
Write-Host "1. Open Raspberry Pi Imager."
Write-Host "2. Gebruik Hostname: $id"
Write-Host "3. Gebruik User: pi | Pass: gridbox2026 | SSH: AAN"
Write-Host "-------------------------------------------------"
pause
