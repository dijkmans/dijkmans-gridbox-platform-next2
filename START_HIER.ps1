$pietScript = @'
# START_HIER.ps1 v1.8 (Directe Installatie)
Clear-Host
$key = "service-account.json"
$repo = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX INSTALLER v1.8                " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

if (-not (Test-Path ".\$key")) {
    Write-Host "❌ FOUT: Ik zie $key niet in Downloads!" -ForegroundColor Red
    pause; return
}

$boxID = Read-Host "`nWelk nieuwe Box ID wil je aanmaken? (bijv. gbox-005)"

Write-Host "🚀 Cloud configureren..." -ForegroundColor Yellow
$pyCode = "import sys; from google.cloud import firestore; from google.oauth2 import service_account; c=service_account.Credentials.from_service_account_file('$key'); db=firestore.Client(credentials=c); s=db.collection('boxes').document('gbox-004').get().to_dict(); s['software']={'currentVersion':'1.0.30'}; db.collection('boxes').document('$boxID').set(s); print('SUCCESS')"

$res = python -c $pyCode
if ($res -match "SUCCESS") { 
    Write-Host "✅ Cloud koppeling gelukt!" -ForegroundColor Green 
} else { 
    Write-Host "❌ Fout: $res" -ForegroundColor Red; pause; return 
}

if (-not (Test-Path ".git")) { 
    Write-Host "📦 Bestanden ophalen..." -ForegroundColor Gray
    git clone $repo . 
} else { 
    git fetch origin; git reset --hard origin/main 
}

Write-Host "`n✨ KLAAR! Je kunt nu flashen." -ForegroundColor Green
Write-Host "Hostname: $boxID | User: pi | Pass: gridbox2026" -ForegroundColor Cyan
pause
'@
$pietScript | Out-File -FilePath "$HOME\Downloads\START_HIER.ps1" -Encoding utf8
Write-Host "`n✅ Bestand START_HIER.ps1 is vers aangemaakt!" -ForegroundColor Green
