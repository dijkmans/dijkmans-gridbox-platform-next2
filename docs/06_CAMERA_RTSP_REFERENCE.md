# Camera RTSP Referentie — Gridbox Platform

> Interne referentie voor installatie, diagnose en troubleshooting van netwerkcamera's
> per box. Bijgewerkt t.e.m. v1.0.104.

---

## Inhoudsopgave

1. [Ondersteunde camera-types](#1-ondersteunde-camera-types)
2. [Gevonden cameras per locatie](#2-gevonden-cameras-per-locatie)
3. [Troubleshooting nieuwe camera](#3-troubleshooting-nieuwe-camera)
4. [JS-truc: verborgen RTSP-poort vinden](#4-js-truc-verborgen-rtsp-poort-vinden)
5. [Versiehistorie camera-fixes](#5-versiehistorie-camera-fixes)

---

## 1. Ondersteunde camera-types

### 1.1 Jovision — Standaard firmware

| Eigenschap         | Waarde                                        |
|--------------------|-----------------------------------------------|
| Boxen              | gbox-012, gbox-013, gbox-024, gbox-025        |
| MAC OUI            | `e0:62:90`                                    |
| RTSP poort         | **8554**                                      |
| RTSP URL           | `rtsp://admin:admin@{ip}:8554/live1.264`      |
| Snapshot CGI       | **BESTAAT NIET** — alleen RTSP                |
| Webinterface       | Klassiek HTML, `<title>` bevat `jovision`     |
| Standaard gebruiker| `admin` / `admin`                             |

**Configuratie in Firestore:**
```
hardware.camera.assignment.snapshotUrl = rtsp://admin:admin@192.168.10.{x}:8554/live1.264
```

---

### 1.2 Jovision — XVR-firmware (afwijkend)

| Eigenschap         | Waarde                                        |
|--------------------|-----------------------------------------------|
| Boxen              | gbox-015                                      |
| MAC OUI            | `e0:62:90` (zelfde fabrikant, andere firmware)|
| RTSP poort         | **5544**                                      |
| RTSP URL           | `rtsp://admin:admin@{ip}:5544/live0.264`      |
| Snapshot CGI       | **BESTAAT NIET** — alleen RTSP                |
| Webinterface       | Angular SPA, `ng-app="myApp"`                 |
| Standaard gebruiker| `admin` / `admin`                             |
| Poort ontdekt via  | zie §4                                        |

**Let op:** De URL gebruikt `live0.264` (niet `live1.264`) en poort 5544 (niet 8554).
Dit is zichtbaar aan de Angular-webinterface — de klassieke Jovision-interface laadt niet.

**Configuratie in Firestore:**
```
hardware.camera.assignment.snapshotUrl = rtsp://admin:admin@192.168.10.{x}:5544/live0.264
```

---

### 1.3 Vatilon — Werkend

| Eigenschap         | Waarde                                              |
|--------------------|-----------------------------------------------------|
| Boxen              | gbox-014                                            |
| Model              | I3004-HSWA                                          |
| MAC OUI            | `e8:b7:23`                                          |
| Fabrikant          | Shenzhen Vatilon Electronics Co., Ltd               |
| RTSP poort         | **554**                                             |
| RTSP URL           | `rtsp://admin:admin1@{ip}:554/stream1`              |
| Snapshot CGI       | **BESTAAT NIET** — alleen RTSP                      |
| Webinterface       | `http://{ip}/view/player.html`                      |
| Standaard gebruiker| `admin` / `admin1`                                  |
| Status             | Werkend in productie (gbox-014, 2026-05-01)         |

**Configuratie in Firestore:**
```
hardware.camera.assignment.snapshotUrl = rtsp://admin:admin1@192.168.10.{x}:554/stream1
```

**Waarom Vatilon niet meteen werkt bij eerste aanpak:**
- Poortscans (80, 554, 8554, 5544) lijken geblokkeerd op standaard netwerkconfiguratie
- De webinterface draait op `/view/player.html`, niet op `/` — een gewone HTTP-check geeft geen respons
- Het standaardwachtwoord is `admin1`, niet `admin` zoals bij Jovision — dit is de meest voorkomende fout
- RTSP draait op poort 554 (standaard), niet op de Jovision-specifieke poorten 8554 of 5544
- Gebruik altijd `-rtsp_transport tcp` bij testen met ffmpeg — UDP werkt niet betrouwbaar met Vatilon

---

## 2. Gevonden cameras per locatie

### Herselt

| Box       | Camera type          | IP (vast)       | MAC                  | RTSP URL                                            | Status   |
|-----------|----------------------|-----------------|----------------------|-----------------------------------------------------|----------|
| gbox-012  | Jovision standaard   | 192.168.10.110  | e0:62:90:0e:89:ec    | `rtsp://admin:admin@192.168.10.110:8554/live1.264`  | Werkend  |
| gbox-013  | Jovision standaard   | 192.168.10.111  | e0:62:90:0e:89:ff    | `rtsp://admin:admin@192.168.10.111:8554/live1.264`  | Werkend  |

> **Let op (2026-05-01):** De camera-assignments van gbox-012 en gbox-015 waren verwisseld in Firestore. Hersteld via handmatige Firestore-swap.

### Geel

| Box       | Camera type          | IP (vast)       | MAC                  | RTSP URL                                            | Status   |
|-----------|----------------------|-----------------|----------------------|-----------------------------------------------------|----------|
| gbox-014  | Vatilon I3004-HSWA   | 192.168.10.103  | e8:b7:23:13:f5:9f    | `rtsp://admin:admin1@192.168.10.103:554/stream1`    | Werkend  |
| gbox-015  | Jovision XVR         | 192.168.10.113  | e0:62:90:31:3f:5f    | `rtsp://admin:admin@192.168.10.113:5544/live0.264`  | Werkend  |
| gbox-024  | Jovision standaard   | 192.168.10.x    | e0:62:90:...         | `rtsp://admin:admin@192.168.10.x:8554/live1.264`    | —        |
| gbox-025  | Jovision standaard   | 192.168.10.x    | e0:62:90:...         | `rtsp://admin:admin@192.168.10.x:8554/live1.264`    | —        |

> Vul IP en volledige MAC in zodra de camera is gekoppeld via de admin-cockpit.

---

## 3. Troubleshooting nieuwe camera

### Stap 1 — Camera detecteren

1. Ga naar de admin-cockpit: `/admin/box/[id]` → sectie **Camera**
2. Klik **Zoek camera opnieuw** — dit leest de DHCP-leases en ARP-tabel van de RUT241
3. Noteer het MAC-adres dat verschijnt (OUI bepaalt het merk — zie §1)

### Stap 2 — Controleer bereikbaarheid

```bash
# Vanuit de Pi via SSH (of via admin-terminal):
ping 192.168.10.{ip}
curl -v http://192.168.10.{ip}/          # Webinterface type bepalen
curl -v http://192.168.10.{ip}/cgi-bin/snapshot.cgi  # Werkt dit?
```

### Stap 3 — Bepaal type via webinterface

| Pagina-kenmerk                  | Type                    |
|---------------------------------|-------------------------|
| `<title>` bevat `jovision`      | Jovision standaard      |
| `ng-app="myApp"` in body        | Jovision XVR-firmware   |
| `/view/player.html` bereikbaar  | Vatilon                 |
| Geen HTTP-verbinding            | Onbekend — probeer §4   |

### Stap 4 — Test RTSP stream

```bash
# Op de Pi (ffmpeg beschikbaar vanaf v1.0.101):
ffmpeg -rtsp_transport tcp -i "rtsp://admin:admin@192.168.10.{ip}:8554/live1.264" \
  -frames:v 1 /tmp/test.jpg

# Als dat mislukt, probeer poort 5544:
ffmpeg -rtsp_transport tcp -i "rtsp://admin:admin@192.168.10.{ip}:5544/live0.264" \
  -frames:v 1 /tmp/test.jpg

# Vatilon (poort 554, wachtwoord admin1):
ffmpeg -rtsp_transport tcp -i "rtsp://admin:admin1@192.168.10.{ip}:554/stream1" \
  -frames:v 1 /tmp/test.jpg
```

### Stap 5 — Configureer snapshotUrl in admin

1. Ga naar `/admin/box/[id]` → Camera → **Geavanceerd**
2. Vul het veld **Snapshot/stream URL** in met de werkende RTSP-URL
3. Klik **Bevestig en koppel camera** (of gebruik handmatige override als de Pi offline is)
4. Klik **Test snapshot** — dit stuurt een commando naar de Pi die een foto maakt en uploadt naar GCS

### Stap 6 — Verificatie

- Controleer GCS bucket: `gridbox-platform.firebasestorage.app/snapshots/{boxId}/`
- Gebruik het diagnose-script: `scripts/diagnose-camera.ps1`
- Controleer de logs op de Pi: `sudo journalctl -u gridbox.service -f`

### Bekende valkuilen

| Symptoom                          | Oorzaak                              | Oplossing                                      |
|-----------------------------------|--------------------------------------|------------------------------------------------|
| `NO_CAMERA` in testresultaat      | `snapshotUrl` leeg in Firestore      | Veld invullen in admin Geavanceerd             |
| `SNAPSHOT_FAILED` — ffmpeg fout   | Verkeerde poort of URL               | Probeer alternatieve poort (§4)                |
| `PI_TIMEOUT`                      | Pi offline of niet gereageerd        | Check heartbeat, herstart service              |
| Foto's worden niet opgeslagen     | `startup_test` fase niet doorlopen   | Bug opgelost in v1.0.99 (underscore vs hyphen) |
| Watchdog crasht elke 5 minuten    | `sd_notify` niet aangeroepen         | Opgelost in v1.0.103                           |
| Vatilon — geen verbinding         | Verkeerd wachtwoord (`admin` i.p.v. `admin1`) | Gebruik `admin1` als wachtwoord         |

---

## 4. JS-truc: verborgen RTSP-poort vinden

Sommige camera's (zoals de Jovision XVR) tonen de RTSP-poort niet in de webinterface,
maar bewaren hem hardcoded in hun JavaScript-bundle.

**Werkwijze:**

```bash
# 1. Haal de JavaScript-bundel op van de camera:
curl http://192.168.10.{ip}/js/dst/myApp.min.js -o myApp.min.js

# 2. Zoek naar poortnummers (typisch 554, 5544, 8554, 1554):
grep -oE '[0-9]{4,5}' myApp.min.js | sort -u | grep -E '^(554|1554|5544|8554|10554)$'
```

**Of in de browser:**
1. Open `http://192.168.10.{ip}/js/dst/myApp.min.js` in Chrome
2. Gebruik Ctrl+F → zoek op `5544`, `8554`, `rtsp`, `live`
3. Noteer de poort en het stream-pad

**Gevonden voor Jovision XVR (gbox-015):**
- Bestand: `/js/dst/myApp.min.js`
- Zoekterm: `5544`
- Gevonden: poort `5544`, stream `live0.264`

---

## 5. Versiehistorie camera-fixes

### v1.0.99 — RTSP-ondersteuning + startup-test bugfix
- `fetch_snapshot_bytes(url, cam_cfg)` toegevoegd aan `listener.py`
- HTTP-cameras: `requests.get()` met `HTTPBasicAuth`
- RTSP-cameras: `ffmpeg -rtsp_transport tcp -frames:v 1` via subprocess
- **Bugfix:** `take_snapshot(phase="startup-test")` faalde omdat de forced-set
  `startup_test` gebruikte (underscore) maar de aanroep een koppelteken. Opgelost.

### v1.0.100 — RTSP credentials injectie
- `fetch_snapshot_bytes()` injecteert `username:password@` in de RTSP-URL als
  deze credentials nog niet in de URL staan en `cam_cfg` ze bevat.

### v1.0.101 — ffmpeg auto-installatie
- `update.sh` installeert ffmpeg via `apt-get` als het nog niet aanwezig is.
  Controle met `dpkg -s ffmpeg` (idempotent).

### v1.0.102 — apt-get update vóór ffmpeg-installatie
- `apt-get update` wordt uitgevoerd binnen het `if !dpkg -s ffmpeg` blok,
  zodat de package-index actueel is bij eerste installatie.

### v1.0.103 — Watchdog sd_notify fix
- `sd_notify("WATCHDOG=1")` aangeroepen in de hoofdlus van `listener.py`.
- Reden: `WatchdogSec=300` was al actief sinds v1.0.96 maar de notify-aanroep
  ontbrak — systemd stuurde elke 300s een SIGABRT. gbox-015 crashte 322 keer.
- Implementatie: pure Python via `AF_UNIX SOCK_DGRAM` op `NOTIFY_SOCKET`.

### v1.0.104 — snapshotUrl configureerbaar
- `PUT /admin/boxes/:boxId/camera` en `POST /admin/boxes/:boxId/camera-assign`
  accepteren een optionele `snapshotUrl` parameter.
- Validatie: URL moet beginnen met `http(s)://192.168.10.x` of `rtsp://192.168.10.x`.
- Fallback als leeg: `http://{ip}/cgi-bin/snapshot.cgi` (standaard HTTP-camera).
- `_handle_test_snapshot_command` in `listener.py` gebruikt nu `fetch_snapshot_bytes()`
  zodat ook RTSP-URLs werken bij de test-snapshot knop.
- Admin UI: veld **Snapshot/stream URL** toegevoegd onder Geavanceerd →
  Camera-instellingen. Wordt meegestuurd bij koppelflow en handmatige override.
