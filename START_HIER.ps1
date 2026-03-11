# START_HIER.ps1 v2.2 - De Bulletproof Editie
Clear-Host
$key = 'service-account.json'
$url = 'https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git'

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '   GRIDBOX INSTALLER v2.2 (Bulletproof)  ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

if (-not (Test-Path ".\$key")) {
    Write-Host 'FOUT: Sleutel niet gevonden in Downloads.' -ForegroundColor Red
    return
}

$boxID = Read-Host 'Welk nieuwe Box ID wilt u aanmaken?'
if (-not $boxID) { $boxID = 'gbox-005' }

Write-Host 'Cloud configureren...' -ForegroundColor Yellow

# Python aanroep zonder Here-String om fouten te voorkomen
$pyPart1 = "import sys; from google.cloud import firestore; from google.oauth2 import service_account; "
$pyPart2 = "c=service_account.Credentials.from_service_account_file('$key'); db=firestore.Client(credentials=c); "
$pyPart3 = "s=db.collection('boxes').document('gbox-004').get().to_dict(); s['software']={'currentVersion':'1.0.30'}; "
$pyPart4 = "db.collection('boxes').document('$boxID').set(s); print('PYTHON_SUCCESS')"
$fullPy = $pyPart1 + $pyPart2 + $pyPart3 + $pyPart4

$res = python -c $fullPy

if ($res -match 'PYTHON_SUCCESS') {
    Write-Host 'Cloud koppeling gelukt!' -ForegroundColor Green
} else {
    Write-Host "Fout in cloud: $res" -ForegroundColor Red
    return
}

if (-not (Test-Path '.git')) {
    Write-Host 'Bestanden ophalen...'
    git clone $url .
} else {
    git fetch origin; git reset --hard origin/main
}

Write-Host "KLAAR! Hostname: $boxID | User: pi | Pass: gridbox2026"
Write-Host 'Druk op een toets om af te sluiten...'
$null = [System.Console]::ReadKey($true)
