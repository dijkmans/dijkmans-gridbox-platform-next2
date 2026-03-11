# START_HIER.ps1 v2.0 - De Definitieve "Gouden Versie"
# Deze versie is geoptimaliseerd om NOOIT meer aanhalingsteken-fouten te geven.

Clear-Host
$keyFile = "service-account.json"
$repoUrl = "https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX INSTALLER v2.0 (Gouden Editie)       " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Controleer of de sleutel in de huidige map staat
if (-not (Test-Path ".\$keyFile")) {
    Write-Host "❌ FOUT: Ik zie $keyFile niet in deze map." -ForegroundColor Red
    Write-Host "Zorg dat je in PowerShell eerst 'cd ~\Downloads' typt." -ForegroundColor Yellow
    pause; return
}

# 2. Vraag het nieuwe nummer
$boxID = Read-Host "`nWelk nieuwe Box ID wilt u aanmaken? (bijv. gbox-005)"
if (-not $boxID) { $boxID = "gbox-005" }

# 3. Firestore actie (Python)
Write-Host "🚀 Cloud configureren voor $boxID..." -ForegroundColor Yellow

# We bouwen het Python script heel zorgvuldig op om SyntaxErrors te voorkomen
$pyCode = @"
import sys
from google.cloud import firestore
from google.oauth2 import service_account

try:
    creds = service_account.Credentials.from_service_account_file('$keyFile')
    db = firestore.Client(credentials=creds)
    
    # Haal template gbox-004 op
    source_ref = db.collection('boxes').document('gbox-004')
    source_doc = source_ref.get()
    
    if source_doc.exists:
        data = source_doc.to_dict()
        # Update software versie
        if 'software' not in data: data['software'] = {}
        data['software']['currentVersion'] = '1.0.30'
        
        # Schrijf naar nieuwe box
        db.collection('boxes').document('$boxID').set(data)
        print("PYTHON_SUCCESS")
    else:
        print("ERROR: gbox-004 niet gevonden in Firestore")
except Exception as e:
    print(f"ERROR: {e}")
"@

# Voer de Python code uit
$result = $pyCode | python

if ($result -match "PYTHON_SUCCESS") {
    Write-Host "✅ Cloud koppeling gelukt!" -ForegroundColor Green
} else {
    Write-Host "❌ Fout in cloud-configuratie: $result" -ForegroundColor Red
    pause; return
}

# 4. Bestanden synchroniseren
Write-Host "📦 Bestanden controleren en ophalen..." -ForegroundColor Gray
if (-not (Test-Path ".git")) {
    git clone $repoUrl .
} else {
    git fetch origin; git reset --hard origin/main
}

# 5. Finale instructies
Write-Host "`n✨ KLAAR! Je kunt nu de SD-kaart flashen." -ForegroundColor Green
Write-Host "-------------------------------------------------"
Write-Host " Hostname: $boxID" -ForegroundColor White
Write-Host " Gebruiker: pi | Wachtwoord: gridbox2026" -ForegroundColor White
Write-Host "-------------------------------------------------"
Write-Host "Druk op een toets om af te sluiten..."
pause
