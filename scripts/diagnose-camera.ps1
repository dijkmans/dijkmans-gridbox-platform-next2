# ============================================================
#  GRIDBOX CAMERA DIAGNOSE SCRIPT
#  Voer uit in PowerShell 7+ (pwsh)
#  Stap 1: vul API_URL en BOX_ID in
#  Stap 2: haal je token op via de browser (zie instructie)
#  Stap 3: voer het script uit
# ============================================================

# ── CONFIGURATIE ─────────────────────────────────────────────
$API_URL  = "https://gridbox-api-960191535038.europe-west1.run.app"
$BOX_ID   = "gbox-012"
$FIREBASE_API_KEY = "AIzaSyCmwIzuvHO4KW8qGMGlNFK4cnBzrVivtQE"

# ── KLEUREN HELPERS ──────────────────────────────────────────
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [XX] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  [..] $msg" -ForegroundColor Cyan }
function Write-Head($msg) { Write-Host "`n== $msg ==" -ForegroundColor White }

# ────────────────────────────────────────────────────────────
#  STAP A: HOE VIND JE DE API URL?
#  1. Open gridbox-platform.web.app in Chrome
#  2. F12 -> Netwerk tab
#  3. Laad de portalpagina opnieuw
#  4. Zoek een request naar "gridbox-api" of "run.app"
#  5. Kopieer de base URL (bijv. https://gridbox-api-xxxx-ew.a.run.app)
#  6. Plak hierboven bij $API_URL

#  STAP B: HOE HAAL JE JE TOKEN OP?
#  1. Open gridbox-platform.web.app in Chrome (aangemeld)
#  2. F12 -> Console tab
#  3. Plak dit commando en druk Enter:
#     (await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js')).getAuth().currentUser.getIdToken(true).then(t => console.log(t))
#  OF simpeler: ga naar Netwerk tab, klik een API-call aan,
#     kopieer de Authorization header waarde (zonder "Bearer ")
# ────────────────────────────────────────────────────────────

function Get-FirebaseToken {
    Write-Head "TOKEN OPHALEN"

    $keuze = Read-Host "  Kies methode:`n  [1] Email + wachtwoord (Firebase REST)`n  [2] Token plakken vanuit browser`n  Keuze"

    if ($keuze -eq "1") {
        $email = Read-Host "  Email"
        $ww    = Read-Host "  Wachtwoord" -AsSecureString
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                     [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ww))

        $body = @{ email = $email; password = $plain; returnSecureToken = $true } | ConvertTo-Json
        try {
            $r = Invoke-RestMethod `
                -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY" `
                -Method POST `
                -Body $body `
                -ContentType "application/json"
            Write-Ok "Aangemeld als $($r.email)"
            return $r.idToken
        } catch {
            Write-Err "Login mislukt: $_"
            exit 1
        }
    } else {
        $token = Read-Host "  Plak je Bearer token (zonder 'Bearer ')"
        return $token.Trim()
    }
}

function Invoke-Api($method, $path, $token, $body = $null) {
    $uri     = "$API_URL$path"
    $headers = @{ Authorization = "Bearer $token" }
    try {
        if ($body) {
            return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers `
                       -Body ($body | ConvertTo-Json) -ContentType "application/json"
        }
        return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $msg    = $_.ErrorDetails.Message
        return @{ __error = $true; status = $status; raw = $msg }
    }
}

# ────────────────────────────────────────────────────────────
#  CHECK 1: API bereikbaar?
# ────────────────────────────────────────────────────────────
function Check-ApiHealth {
    Write-Head "CHECK 1 — API health"
    try {
        $r = Invoke-RestMethod -Uri "$API_URL/health" -TimeoutSec 10
        Write-Ok "API bereikbaar: $($r | ConvertTo-Json -Compress)"
    } catch {
        Write-Err "API NIET bereikbaar op $API_URL"
        Write-Warn "Controleer de URL in het script (\$API_URL)"
        exit 1
    }
}

# ────────────────────────────────────────────────────────────
#  CHECK 2: Ben ik aangemeld?
# ────────────────────────────────────────────────────────────
function Check-Auth($token) {
    Write-Head "CHECK 2 — Authenticatie"
    $r = Invoke-Api "GET" "/portal/me" $token
    if ($r.__error) {
        Write-Err "Token ongeldig of verlopen (status $($r.status))"
        Write-Warn "Haal een nieuw token op via de browser"
        exit 1
    }
    Write-Ok "Aangemeld als: $($r.email)"
    Write-Info "Role: $($r.membership.role)  |  customerId: $($r.membership.customerId)"
}

# ────────────────────────────────────────────────────────────
#  CHECK 3: Box status (online/offline? heartbeat?)
# ────────────────────────────────────────────────────────────
function Check-BoxStatus($token) {
    Write-Head "CHECK 3 — Box status: $BOX_ID"
    $r = Invoke-Api "GET" "/portal/boxes/$BOX_ID" $token
    if ($r.__error) {
        Write-Err "Box ophalen mislukt (status $($r.status)): $($r.raw)"
        return
    }

    $status    = $r.status
    $heartbeat = $r.software.lastHeartbeatIso ?? $r.state.lastHeartbeatAt ?? "(onbekend)"
    $version   = $r.software.currentVersion   ?? "(onbekend)"

    if ($status -eq "online") {
        Write-Ok "Status: ONLINE"
    } else {
        Write-Err "Status: $($status.ToUpper()) — Pi is waarschijnlijk offline!"
    }

    Write-Info "Laatste heartbeat : $heartbeat"
    Write-Info "Softwareversie    : $version"

    # Bereken hoe lang geleden heartbeat was
    if ($heartbeat -ne "(onbekend)") {
        try {
            $hbTime = [DateTimeOffset]::Parse($heartbeat)
            $diff   = [DateTimeOffset]::UtcNow - $hbTime
            if ($diff.TotalMinutes -lt 3) {
                Write-Ok "Heartbeat $([int]$diff.TotalSeconds)s geleden — Pi is actief"
            } elseif ($diff.TotalMinutes -lt 10) {
                Write-Warn "Heartbeat $([int]$diff.TotalMinutes) minuten geleden — Pi is traag"
            } else {
                Write-Err "Heartbeat $([int]$diff.TotalMinutes) minuten geleden — Pi is OFFLINE"
            }
        } catch {}
    }
}

# ────────────────────────────────────────────────────────────
#  CHECK 4: Camera config correct?
# ────────────────────────────────────────────────────────────
function Check-CameraConfig($token) {
    Write-Head "CHECK 4 — Camera configuratie: $BOX_ID"
    $r = Invoke-Api "GET" "/admin/boxes/$BOX_ID/camera" $token
    if ($r.__error) {
        Write-Err "Camera config ophalen mislukt (status $($r.status))"
        Write-Warn "Heb je platformAdmin-rechten?"
        return
    }

    $cfg        = $r.config
    $assignment = $r.assignment

    Write-Info "config.enabled     : $($cfg.enabled)"
    Write-Info "config.username    : $($cfg.username)"
    Write-Info "config.password    : $($cfg.password)"
    Write-Info "assignment.ip      : $($assignment.ip)"
    Write-Info "assignment.mac     : $($assignment.mac)"
    Write-Info "assignment.url     : $($assignment.snapshotUrl)"

    if ($cfg.enabled -eq $true) {
        Write-Ok "Camera is INGESCHAKELD"
    } else {
        Write-Err "Camera staat UIT (config.enabled = false)"
    }

    if ($assignment.snapshotUrl) {
        Write-Ok "snapshotUrl aanwezig: $($assignment.snapshotUrl)"
    } else {
        Write-Err "snapshotUrl is LEEG — Pi weet niet waar hij foto's moet ophalen"
    }
}

# ────────────────────────────────────────────────────────────
#  CHECK 5: Test snapshot via admin endpoint (Pi moet online zijn)
# ────────────────────────────────────────────────────────────
function Check-TestSnapshot($token) {
    Write-Head "CHECK 5 — Test snapshot (wacht max 15s op Pi...)"
    Write-Info "Stuurt test_snapshot command naar Pi via Firestore..."

    $r = Invoke-Api "GET" "/admin/boxes/$BOX_ID/camera/snapshot" $token
    if ($r.__error) {
        $raw = $r.raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        $err = $raw.error ?? "ONBEKEND"
        $msg = $raw.message ?? $r.raw

        switch ($err) {
            "PI_TIMEOUT"      { Write-Err "PI_TIMEOUT — Pi reageert niet binnen 15s (offline of config niet ingeladen)" }
            "SNAPSHOT_FAILED" { Write-Err "SNAPSHOT_FAILED — Pi draait maar camera is niet bereikbaar: $msg" }
            "NO_CAMERA"       { Write-Err "NO_CAMERA — snapshotUrl niet ingevuld in Firestore" }
            "UNAUTHORIZED"    { Write-Err "Niet aangemeld (token verlopen?)" }
            "FORBIDDEN"       { Write-Err "Geen platformAdmin-rechten" }
            default           { Write-Err "Fout ($($r.status)): $msg" }
        }
        return
    }

    if ($r.ok) {
        Write-Ok "SNAPSHOT GESLAAGD!"
        Write-Info "GCS URL: $($r.snapshotUrl)"
    } else {
        Write-Warn "Onverwacht antwoord: $($r | ConvertTo-Json -Compress)"
    }
}

# ────────────────────────────────────────────────────────────
#  CHECK 6: Staan er al foto's in GCS?
# ────────────────────────────────────────────────────────────
function Check-Photos($token) {
    Write-Head "CHECK 6 — Foto's in GCS voor $BOX_ID"
    $r = Invoke-Api "GET" "/portal/boxes/$BOX_ID/photos" $token
    if ($r.__error) {
        Write-Err "Foto's ophalen mislukt (status $($r.status)): $($r.raw)"
        return
    }

    $count = $r.count ?? 0
    if ($count -eq 0) {
        Write-Err "GEEN foto's gevonden in GCS voor $BOX_ID"
        Write-Warn "De Pi heeft nog nooit een foto opgeslagen voor deze box"
    } else {
        Write-Ok "$count foto('s) gevonden in GCS"
        Write-Info "Nieuwste foto:"
        $newest = $r.items | Select-Object -First 1
        Write-Info "  Bestandsnaam : $($newest.filename)"
        Write-Info "  Opgeslagen   : $($newest.updatedAt)"
        Write-Info "  Grootte      : $($newest.size) bytes"
    }
}

# ────────────────────────────────────────────────────────────
#  CHECK 7: Live picture endpoint (wat de portal gebruikt)
# ────────────────────────────────────────────────────────────
function Check-PictureEndpoint($token) {
    Write-Head "CHECK 7 — Portal /picture endpoint"
    $uri     = "$API_URL/portal/boxes/$BOX_ID/picture"
    $headers = @{ Authorization = "Bearer $token" }
    try {
        $response = Invoke-WebRequest -Uri $uri -Headers $headers -TimeoutSec 15
        $kb = [Math]::Round($response.Content.Length / 1024, 1)
        Write-Ok "Foto ontvangen: $kb KB — portal ZOU een foto moeten tonen"
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $body   = $_.ErrorDetails.Message
        $parsed = $body | ConvertFrom-Json -ErrorAction SilentlyContinue
        $err    = $parsed.error ?? "HTTP $status"
        switch ($err) {
            "NO_PICTURES_YET" { Write-Err "NO_PICTURES_YET — GCS is leeg voor deze box" }
            "BOX_NOT_FOUND"   { Write-Err "BOX_NOT_FOUND — box $BOX_ID bestaat niet" }
            default           { Write-Err "Fout: $err — $($parsed.message ?? $body)" }
        }
    }
}

# ────────────────────────────────────────────────────────────
#  HOOFDPROGRAMMA
# ────────────────────────────────────────────────────────────
Clear-Host
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  GRIDBOX CAMERA DIAGNOSE  —  $BOX_ID" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  API : $API_URL"
Write-Host "  Box : $BOX_ID"
Write-Host ""

# Stap 1: API URL check
if ($API_URL -like "*JOUW-HASH*") {
    Write-Host ""
    Write-Host "  CONFIGURATIE VEREIST:" -ForegroundColor Yellow
    Write-Host "  Vul de echte API URL in bij `$API_URL bovenaan het script." -ForegroundColor Yellow
    Write-Host "  Zoek via F12 -> Netwerk op gridbox-platform.web.app" -ForegroundColor Yellow
    Write-Host ""
    $API_URL = Read-Host "  Of plak de API URL hier"
    $API_URL = $API_URL.TrimEnd("/")
}

Check-ApiHealth

$token = Get-FirebaseToken

Check-Auth            $token
Check-BoxStatus       $token
Check-CameraConfig    $token
Check-TestSnapshot    $token
Check-Photos          $token
Check-PictureEndpoint $token

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSE AFGEROND" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan
