# START_HIER.ps1 v3.1 - De 'Geen-Gezever' Editie
Clear-Host
$k = 'service-account.json'
$repo = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '   GRIDBOX ASSISTENT v3.1                ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

# 1. Sleutel check
if (!(Test-Path $k)) {
    Write-Host 'FOUT: Sleutel niet gevonden in Downloads!' -ForegroundColor Red
    pause; return
}

# 2. Box ID vragen
$id = Read-Host 'Welk nieuwe Box ID wilt u aanmaken?'
if (!$id) { $id = 'gbox-005' }

# 3. Cloud configureren
Write-Host 'Cloud configureren...' -ForegroundColor Yellow
$p1 = "import sys; from google.cloud import firestore; from google.oauth2 import service_account; "
$p2 = "c=service_account.Credentials.from_service_account_file('$k'); db=firestore.Client(credentials=c); "
$p3 = "s=db.collection('boxes').document('gbox-004').get().to_dict(); s['software']={'currentVersion':'1.0.30'}; "
$p4 = "db.collection('boxes').document('$id').set(s); print('SUCCESS')"
$pyCode = $p1 + $p2 + $p3 + $p4

$res = python -c $pyCode

if ($res -match 'SUCCESS') {
    Write-Host '✅ Cloud koppeling gelukt!' -ForegroundColor Green
} else {
    Write-Host "❌ Fout: $res" -ForegroundColor Red
    pause; return
}

# 4. Git synchronisatie
if (!(Test-Path '.git')) {
    Write-Host '📦 Bestanden ophalen...' -ForegroundColor Gray
    git clone $repo .
} else {
    git fetch origin; git reset --hard origin/main
}

Write-Host '✨ KLAAR!' -ForegroundColor Green
Write-Host "Hostname: $id | User: pi | Pass: gridbox2026" -ForegroundColor Cyan
pause
