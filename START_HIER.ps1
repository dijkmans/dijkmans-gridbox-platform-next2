# GRIDBOX INSTALLER v3.0 - Definitieve Versie
Clear-Host
$k = "service-account.json"
$repo = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX ASSISTENT v3.0                " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check of de sleutel aanwezig is
if (!(Test-Path $k)) {
    Write-Host "❌ FOUT: Sleutel ($k) niet gevonden in Downloads!" -ForegroundColor Red
    Write-Host "Zorg dat je eerst 'cd ~\Downloads' typt." -ForegroundColor Yellow
    pause; return
}

# 2. Vraag het ID
$id = Read-Host "`nWelk nieuwe Box ID wilt u aanmaken? (bijv. gbox-005)"
if (!$id) { $id = "gbox-005" }

# 3. Cloud instellen via Python
Write-Host "🚀 Cloud configureren voor $id..." -ForegroundColor Yellow
$py = "import sys; from google.cloud import firestore; from google.oauth2 import service_account; " + `
"c=service_account.Credentials.from_service_account_file('$k'); " + `
"db=firestore.Client(credentials=c); " + `
"s=db.collection('boxes').document('gbox-004').get().to_dict(); " + `
"s['software']={'currentVersion':'1.0.30'}; " + `
"db.collection('boxes').document('$id').set(s); print('SUCCESS')"

$res = python -c $py

if ($res -match "SUCCESS") {
    Write-Host "✅ Cloud koppeling gelukt!" -ForegroundColor Green
} else {
    Write-Host "❌ Fout: $res" -ForegroundColor Red
    pause; return
}

# 4. Git download (indien nog niet aanwezig)
if (!(Test-Path ".git")) {
    Write-Host "📦 Bestanden ophalen van GitHub..." -ForegroundColor Gray
    git clone $repo .
} else {
    git fetch origin; git reset --hard origin/main
}

Write-Host "`n✨ KLAAR! Je kunt nu de SD-kaart flashen." -ForegroundColor Green
Write-Host "Hostname: $id | User: pi | Pass: gridbox2026" -ForegroundColor Cyan
pause
