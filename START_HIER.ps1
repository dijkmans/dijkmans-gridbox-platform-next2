# START_HIER.ps1 (v1.7 - De Master Editie)
Clear-Host
$key = "service-account.json"
$repoUrl = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX INSTALLER v1.7 (Master)       " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check of we in de juiste map staan
if (-not (Test-Path ".\$key")) {
    Write-Host "❌ FOUT: Ik zie de sleutel ($key) niet." -ForegroundColor Red
    Write-Host "Zorg dat je eerst 'cd ~\Downloads' typt!" -ForegroundColor Yellow
    pause; return
}

# 2. Vraag het nieuwe Box ID
$boxID = Read-Host "`nWelk nieuwe Box ID wil je aanmaken? (bijv. gbox-005)"

# 3. Firestore regelen via een tijdelijk hulpbestand
Write-Host "🚀 Cloud configureren voor $boxID..." -ForegroundColor Yellow

$pythonCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account

def run():
    try:
        creds = service_account.Credentials.from_service_account_file('$key')
        db = firestore.Client(credentials=creds)
        source_ref = db.collection('boxes').document('gbox-004')
        source = source_ref.get().to_dict()
        
        if source:
            # Update versie naar de gouden versie
            if 'software' not in source: source['software'] = {}
            source['software']['currentVersion'] = '1.0.30'
            
            db.collection('boxes').document('$boxID').set(source)
            print('SUCCESS')
        else:
            print('ERROR: Bron gbox-004 niet gevonden')
    except Exception as e:
        print(f'ERROR: {e}')

if __name__ == '__main__':
    run()
"@

# Schrijf code naar tijdelijk bestand en voer uit
$pythonCode | Out-File -FilePath "temp_cloud_task.py" -Encoding utf8
$result = python temp_cloud_task.py
Remove-Item "temp_cloud_task.py" -ErrorAction SilentlyContinue

if ($result -match "SUCCESS") { 
    Write-Host "✅ Cloud koppeling gelukt voor $boxID!" -ForegroundColor Green 
} else { 
    Write-Host "❌ Cloud fout: $result" -ForegroundColor Red
    pause; return 
}

# 4. Download de rest van de bestanden indien nodig
if (-not (Test-Path ".git")) {
    Write-Host "📦 Ophalen van overige bestanden van GitHub..." -ForegroundColor Gray
    git clone $repoUrl .
} else {
    git fetch origin; git reset --hard origin/main
}

# 5. Afronden
Write-Host "`n✨ KLAAR! Je kunt nu de SD-kaart flashen." -ForegroundColor Green
Write-Host "-------------------------------------------------"
Write-Host " Hostname: $boxID" -ForegroundColor Cyan
Write-Host " Gebruiker: pi | Wachtwoord: gridbox2026" -ForegroundColor Cyan
Write-Host "-------------------------------------------------"
pause
