# START_HIER.ps1 v2.1
Clear-Host
$keyFile = 'service-account.json'
$repoUrl = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'

Write-Host '=== GRIDBOX INSTALLER v2.1 ===' -ForegroundColor Cyan

if (-not (Test-Path ".\$keyFile")) {
    Write-Host 'FOUT: Sleutel niet gevonden. Typ eerst: cd ~\Downloads' -ForegroundColor Red
    return
}

$boxID = Read-Host 'Welk nieuwe Box ID wilt u aanmaken?'
if (-not $boxID) { $boxID = 'gbox-005' }

Write-Host 'Cloud configureren...' -ForegroundColor Yellow
$pyCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account
try:
    creds = service_account.Credentials.from_service_account_file('$keyFile')
    db = firestore.Client(credentials=creds)
    source = db.collection('boxes').document('gbox-004').get().to_dict()
    if source:
        if 'software' not in source: source['software'] = {}
        source['software']['currentVersion'] = '1.0.30'
        db.collection('boxes').document('$boxID').set(source)
        print('PYTHON_SUCCESS')
except Exception as e:
    print(f'ERROR: {e}')
"@

$result = $pyCode | python
if ($result -match 'PYTHON_SUCCESS') {
    Write-Host 'Cloud koppeling gelukt!' -ForegroundColor Green
} else {
    Write-Host "Fout: $result" -ForegroundColor Red
    return
}

if (-not (Test-Path '.git')) {
    git clone $repoUrl .
} else {
    git fetch origin; git reset --hard origin/main
}

Write-Host "KLAAR! Hostname: $boxID | User: pi | Pass: gridbox2026"
Read-Host 'Druk op Enter om af te sluiten'
