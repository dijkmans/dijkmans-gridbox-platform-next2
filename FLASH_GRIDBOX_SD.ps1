# FLASH_GRIDBOX_SD.ps1 — Gridbox SD-kaart voorbereiding
# Versie: 2.0
# Gebaseerd op v1.0.60 — gbox-003 als referentie
# Gebruik: voer dit script uit NADAT Raspberry Pi Imager klaar is

Clear-Host
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   GRIDBOX SD-KAART VOORBEREIDING v2.0          " -ForegroundColor Cyan
Write-Host "   Gebaseerd op listener v1.0.60                " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# ─── CONFIGURATIE ───────────────────────────────────────────────────────────

$API_BASE_URL = "https://gridbox-api-960191535038.europe-west1.run.app"
$SCRIPT_DIR   = Split-Path -Parent $MyInvocation.MyCommand.Path
$KEY_SRC      = Join-Path $SCRIPT_DIR "service-account.json"

# ─── STAP 1: SERVICE ACCOUNT KEY ────────────────────────────────────────────

Write-Host "STAP 1: Service account key controleren..." -ForegroundColor Yellow

if (-not (Test-Path $KEY_SRC)) {
    # Probeer Downloads
    $KEY_SRC = "$HOME\Downloads\service-account.json"
    if (-not (Test-Path $KEY_SRC)) {
        Write-Host "FOUT: service-account.json niet gevonden." -ForegroundColor Red
        Write-Host "Zet het bestand naast dit script of in Downloads." -ForegroundColor Red
        Read-Host "Druk Enter om te sluiten"
        exit 1
    }
}
Write-Host "OK: service-account.json gevonden op $KEY_SRC" -ForegroundColor Green

# ─── STAP 2: BOX ID ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "STAP 2: Box ID invoeren" -ForegroundColor Yellow
$BOX_ID = Read-Host "Box ID (bijv. gbox-015)"
if ([string]::IsNullOrWhiteSpace($BOX_ID)) {
    Write-Host "FOUT: Geen Box ID ingevoerd." -ForegroundColor Red
    Read-Host "Druk Enter om te sluiten"
    exit 1
}

# ─── STAP 3: PROVISIONING ID ────────────────────────────────────────────────

Write-Host ""
Write-Host "STAP 3: Provisioning gegevens" -ForegroundColor Yellow
$PROVISIONING_ID = Read-Host "Provisioning ID (uit Admin UI)"
if ([string]::IsNullOrWhiteSpace($PROVISIONING_ID)) {
    Write-Host "FOUT: Geen Provisioning ID ingevoerd." -ForegroundColor Red
    Read-Host "Druk Enter om te sluiten"
    exit 1
}

$BOOTSTRAP_TOKEN = Read-Host "Bootstrap Token (uit Admin UI)"
if ([string]::IsNullOrWhiteSpace($BOOTSTRAP_TOKEN)) {
    Write-Host "FOUT: Geen Bootstrap Token ingevoerd." -ForegroundColor Red
    Read-Host "Druk Enter om te sluiten"
    exit 1
}

$CUSTOMER_ID = Read-Host "Customer ID (bijv. Powergrid)"
$SITE_ID     = Read-Host "Site ID (bijv. powergrid-geel)"

# ─── STAP 4: SD-KAART DETECTEREN ────────────────────────────────────────────

Write-Host ""
Write-Host "STAP 4: SD-kaart detecteren..." -ForegroundColor Yellow

# Zoek bootpartitie (label 'bootfs' of eerste FAT32 niet C:)
$bootDrive = $null

# Probeer op label
$vol = Get-Volume | Where-Object { $_.FileSystemLabel -eq "bootfs" } | Select-Object -First 1
if ($vol) {
    $bootDrive = $vol.DriveLetter + ":"
    Write-Host "OK: Bootpartitie gevonden via label: $bootDrive" -ForegroundColor Green
}

# Fallback: FAT32 niet C:
if (-not $bootDrive) {
    $vol = Get-Volume | Where-Object { 
        $_.FileSystem -eq "FAT32" -and $_.DriveLetter -ne "C" -and $_.DriveLetter -ne $null
    } | Select-Object -First 1
    if ($vol) {
        $bootDrive = $vol.DriveLetter + ":"
        Write-Host "OK: Bootpartitie gevonden via FAT32: $bootDrive" -ForegroundColor Green
    }
}

# Handmatig
if (-not $bootDrive) {
    Write-Host ""
    Write-Host "Bootpartitie niet automatisch gevonden." -ForegroundColor Yellow
    Write-Host "Beschikbare volumes:" -ForegroundColor Yellow
    Get-Volume | Where-Object { $_.DriveLetter -ne $null } | 
        Format-Table DriveLetter, FileSystemLabel, FileSystem, Size -AutoSize
    $letter = Read-Host "Geef de schijfletter van de bootpartitie (bijv. D)"
    $bootDrive = $letter.TrimEnd(':') + ":"
}

if (-not (Test-Path $bootDrive)) {
    Write-Host "FOUT: Schijf $bootDrive niet bereikbaar." -ForegroundColor Red
    Read-Host "Druk Enter om te sluiten"
    exit 1
}

# ─── STAP 5: BESTANDEN SCHRIJVEN ────────────────────────────────────────────

Write-Host ""
Write-Host "STAP 5: Bestanden schrijven naar $bootDrive..." -ForegroundColor Yellow

# box_bootstrap.json — zonder BOM, correcte encoding
$bootstrap = @{
    boxId          = $BOX_ID
    provisioningId = $PROVISIONING_ID
    bootstrapToken = $BOOTSTRAP_TOKEN
    customerId     = $CUSTOMER_ID
    siteId         = $SITE_ID
    apiBaseUrl     = $API_BASE_URL
} | ConvertTo-Json -Compress

$bootstrapPath = "$bootDrive\box_bootstrap.json"
[System.IO.File]::WriteAllText($bootstrapPath, $bootstrap, [System.Text.UTF8Encoding]::new($false))
Write-Host "OK: box_bootstrap.json geschreven" -ForegroundColor Green

# service-account.json kopiëren
Copy-Item $KEY_SRC -Destination "$bootDrive\service-account.json" -Force
Write-Host "OK: service-account.json gekopieerd" -ForegroundColor Green

# user-data — generiek, zonder boxId in hostname
$userData = @"
#cloud-config
hostname: gridbox
manage_etc_hosts: true
users:
  - name: pi
    groups: sudo
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    lock_passwd: false
    passwd: "`$6`$tg23.88YXBunN.r4`$6El6fTCo4xsXSMh97vjq887wBTRLNhoESpYrhh8r0aaL1FLcmAGHK1tz9nwddranvunS2CBoILivN559d/Byr0"
ssh_pwauth: true
chpasswd:
  expire: false
"@
[System.IO.File]::WriteAllText("$bootDrive\user-data", $userData, [System.Text.UTF8Encoding]::new($false))
Write-Host "OK: user-data geschreven" -ForegroundColor Green

# ─── STAP 6: VERIFICATIE ────────────────────────────────────────────────────

Write-Host ""
Write-Host "STAP 6: Verificatie..." -ForegroundColor Yellow

$ok = $true
foreach ($file in @("box_bootstrap.json", "service-account.json", "user-data")) {
    if (Test-Path "$bootDrive\$file") {
        Write-Host "OK: $file aanwezig" -ForegroundColor Green
    } else {
        Write-Host "FOUT: $file ontbreekt!" -ForegroundColor Red
        $ok = $false
    }
}

# Controleer geen BOM in bootstrap
$bytes = [System.IO.File]::ReadAllBytes($bootstrapPath)
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "FOUT: box_bootstrap.json heeft een BOM!" -ForegroundColor Red
    $ok = $false
} else {
    Write-Host "OK: box_bootstrap.json heeft geen BOM" -ForegroundColor Green
}

# ─── KLAAR ──────────────────────────────────────────────────────────────────

Write-Host ""
if ($ok) {
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host "   SD-KAART KLAAR VOOR $BOX_ID" -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Volgende stap: SD-kaart uittrekken en in de Pi steken." -ForegroundColor Cyan
    Write-Host "De Pi bootstrapt automatisch als $BOX_ID." -ForegroundColor Cyan
} else {
    Write-Host "=================================================" -ForegroundColor Red
    Write-Host "   FOUTEN GEVONDEN — controleer bovenstaande     " -ForegroundColor Red
    Write-Host "=================================================" -ForegroundColor Red
}

Write-Host ""
Read-Host "Druk Enter om te sluiten"
