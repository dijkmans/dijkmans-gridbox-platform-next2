# START_HIER.ps1 v3.3 - De Officiële Werkende Versie
Clear-Host
$k = 'service-account.json'
$repo = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'

Write-Host '=== GRIDBOX ASSISTENT v3.3 ===' -ForegroundColor Cyan

if (!(Test-Path $k)) {
    Write-Host 'FOUT: Sleutel niet gevonden in Downloads!' -ForegroundColor Red
    return
}

$id = Read-Host 'Welk nieuwe Box ID wilt u aanmaken?'
if (!$id) { $id = 'gbox-005' }

Write-Host 'Cloud configureren...' -ForegroundColor Yellow
$p1 = 'import sys; from google.cloud import firestore; from google.oauth2 import service_account; '
$p2 = 'c=service_account.Credentials.from_service_account_file("' + $k + '"); db=firestore.Client(credentials=c); '
$p3 = 's=db.collection("boxes").document("gbox-004").get().to_dict(); s["software"]={"currentVersion":"1.0.30"}; '
$p4 = 'db.collection("boxes").document("' + $id + '").set(s); print("SUCCESS")'
$pyCode = $p1 + $p2 + $p3 + $p4

$res = python -c $pyCode

if ($res -match 'SUCCESS') {
    Write-Host 'Cloud koppeling gelukt!' -ForegroundColor Green
} else {
    Write-Host 'Fout in cloud.'
}

if (!(Test-Path '.git')) {
    git clone $repo .
} else {
    git fetch origin; git reset --hard origin/main
}

Write-Host 'KLAAR!' -ForegroundColor Green
Write-Host "ID: $id | User: pi | Pass: gridbox2026"
Read-Host 'Druk op Enter om te stoppen'
