# START_HIER.ps1 (v1.4 - De "Plug & Play" Editie)
Clear-Host
$repoUrl = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"
$keyPath = "$HOME\Downloads\service-account.json"
$localKey = ".\src\service-account.json"
$configFile = ".\src\box_config.json"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX EEN-KLIK INSTALLER v1.4               " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# STAP 1: Onderdelen ophalen (Eerst doen, anders is er geen 'src' map!)
Write-Host "📦 Nieuwste onderdelen ophalen van GitHub..." -ForegroundColor Gray
if (-not (Test-Path ".git")) {
    git clone $repoUrl .
} else {
    git fetch origin; git reset --hard origin/main
}

# STAP 2: De Sleutel-Check (Nu naar de src map!)
if (Test-Path $keyPath) {
    Write-Host "✅ Sleutel gevonden in Downloads. Ik verplaats hem naar de /src map..." -ForegroundColor Green
    Copy-Item $keyPath -Destination $localKey -Force
} elseif (-not (Test-Path $localKey)) {
    Write-Host "❌ SLEUTEL NIET GEVONDEN! Zet 'service-account.json' in Downloads." -ForegroundColor Red
    pause; return
} else {
    Write-Host "✅ Bestaande sleutel in /src gevonden." -ForegroundColor Green
}

# STAP 3: De Vraag
$targetID = Read-Host "`nWelke nieuwe Box ID wil je aanmaken? (bijv. gbox-006)"
if ([string]::IsNullOrWhiteSpace($targetID)) {
    Write-Host "❌ Geen ID ingevoerd. Stop." -ForegroundColor Red
    pause; return
}

# STAP 4: box_config.json aanmaken
Write-Host "⚙️  Configuratiebestand (box_config.json) maken voor $targetID..." -ForegroundColor Gray
$boxConfig = @"
{
  "deviceId": "$targetID",
  "software": {
    "deploymentMode": "firestore"
  }
}
"@
Set-Content -Path $configFile -Value $boxConfig -Encoding UTF8

# STAP 5: De Python Actie (Kopieer gbox-005 en maak hem schoon!)
Write-Host "☁️  Firestore instellen..." -ForegroundColor Gray
$pythonCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account

try:
    creds = service_account.Credentials.from_service_account_file('src/service-account.json')
    db = firestore.Client(credentials=creds)
    
    # We pakken gbox-005 als de werkende basis
    source_doc = db.collection('boxes').document('gbox-005').get()
    
    if source_doc.exists:
        data = source_doc.to_dict()
        
        # Maak de nieuwe box 'schoon'
        data['status'] = 'new_install'
        if 'software' in data:
            data['software']['versionRaspberry'] = 'unknown'
            data['software']['deploymentStatus'] = 'PENDING'
            data['software']['updateStatus'] = 'PENDING'
        if 'state' in data:
            data['state']['status'] = 'offline'
            
        db.collection('boxes').document('$targetID').set(data)
        print('SUCCESS')
    else:
        print('ERROR: gbox-005 niet gevonden')
except Exception as e: 
    print(f'ERROR: {e}')
"@

$result = $pythonCode | python
if ($result -contains "SUCCESS") { 
    Write-Host "✅ Cloud gereed. $targetID staat in Firestore!" -ForegroundColor Green 
} else {
    Write-Host "❌ Fout in de Cloud Setup: $result" -ForegroundColor Red
}

Write-Host "`n🚀 KLAAR! Je kunt nu de Imager gebruiken." -ForegroundColor Green
pause