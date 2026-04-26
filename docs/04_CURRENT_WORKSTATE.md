# CURRENT WORKSTATE

## Status — 2026-04-26

P0 safety fix uitgerold als v1.0.94: box opende spontaan bij herstart
doordat Firestore on_snapshot pending commands herspecelde. Fix negeert
commands aangemaakt vóór LISTENER_STARTED_AT en markeert ze als
`ignored_stale` in Firestore.

Cloud Function `checkBoxHeartbeats` gedeployed: schrijft `status: "offline"`
als `software.lastHeartbeatIso` ouder is dan 5 minuten. listener.py herstelt
`status: "online"` bij volgende heartbeat. Operations pagina toonde heartbeat
timestamps al correct — geen frontendwijziging nodig.

Oracle VPS aangemaakt: 141.145.215.74 — nog niet in gebruik.

## Status — 2026-04-21

RUT-info herstructureerd naar `hardware.rut.config` + `hardware.rut.observed`. Camera-info herstructureerd naar `hardware.camera.config` + `assignment` + `observed`. Firestore migratiescript uitgevoerd voor RUT (7 boxes). Camera-config endpoint bijgewerkt; PUT /camera schrijft naar assignment.*; snapshot endpoint leest uit assignment + config.

### Camera-flow herstructurering (april 2026)
- `hardware.camera` opgesplitst in `config`, `assignment`, `observed`
- credentials (username/password) verplaatst van plat niveau naar `config`
- `suggestedIp` is niet persisted, alleen in backend response en UI state
- `observed` wordt bijgewerkt bij elke `camera-context` aanroep (best-effort)
- Platte velden `hardware.camera.ip/mac/snapshotUrl/username/password` zijn vervangen door geneste structuur
- `detectionStatus`, `reservedAt`, `suggestedIp` als vaste Firestore-velden vervallen

### RUT-flow herstructurering (april 2026)
- `hardware.rut` opgesplitst in `config` (admin) en `observed` (listener)
- Top-level `rut.*` op box-documenten verwijderd via migratie
- Listener schrijft uitsluitend naar `hardware.rut.observed.*`
- Admin schrijft uitsluitend naar `hardware.rut.config.*`

## Status — 2026-04-18

Magic Link login toegevoegd naast Google login. PlatformAdmin fix: `requireCustomerContext` slaat `customerId`-check over voor platformAdmin — piet.dijkmans@gmail.com ziet nu alle boxen in de portal. Mobiele viewport fix: `Viewport` export in `layout.tsx`, `overflow-x: hidden` op html/body, header responsive padding. Camera beheer gebouwd (discovery endpoint op device, next-camera-ip + GET/PUT/snapshot op admin, conditioneel UI-blok in AdminBoxConfigClient). gridbox-api gedeployed naar Cloud Run revision `gridbox-api-00733-cs4`. gridbox-portal gedeployed naar Firebase Hosting.

## Fixes 2026-04-18

### Magic Link login
- `firebase.ts`: `magicLinkSettings` en `sendSignInLinkToEmail` geïmporteerd en geconfigureerd
- `AuthPanel.tsx`: twee loginopties naast elkaar (Google + Magic Link formulier)
- `activate-invite/page.tsx`: beide loginopties in wizard stap 1
- Firebase Console: Email/Password én Email link (passwordless) actief
- GSM-nummer opgeslagen in Firestore membership: `phoneNumber` + `phoneVerified`

### PlatformAdmin portal fix
- `requireCustomerContext` in `boxes.ts`: platformAdmin bypass — geen `customerId` vereist
- `/portal/boxes`: platformAdmin ziet alle boxen zonder `customerBoxAccess` filter
- `context.customer?.logoPath` beveiligd met optional chaining
- `GET /portal/me` debug endpoint toegevoegd (retourneert uid, email, membership)

### Mobiele viewport
- `layout.tsx`: `Viewport` export (`width: device-width`, `initialScale: 1`)
- `layout.tsx`: `overflowX: hidden` op `<html>` en `<body>` (fix voor iOS Safari snap-back na scrollen)
- Header section: `px-4 lg:px-8` (was vaste `px-8`)
- Logo: `h-16 lg:h-32 max-w-[120px] lg:max-w-[200px]`
- Titel: `text-2xl lg:text-3xl`
- Artikel linkerkolom: `min-w-0` (was `min-w-[280px]`)

### Camera beheer
- `device.ts`: `POST /device/camera/discovery` — Pi meldt gedetecteerde camera (mac + detectedIp), schrijft `detectionStatus = "detected"`
- `admin.ts`: `GET /admin/boxes/next-camera-ip` — geeft eerste vrij IP in range 192.168.10.100–249
- `admin.ts`: `GET /admin/boxes/:boxId/camera` — haalt camera config op
- `admin.ts`: `PUT /admin/boxes/:boxId/camera` — slaat mac/ip/username/password op, berekent snapshotUrl automatisch
- `admin.ts`: `GET /admin/boxes/:boxId/camera/snapshot` — live snapshot via snapshotUrl met optionele BasicAuth
- `AdminBoxConfigClient.tsx`: conditioneel camera-blok op basis van `detectionStatus` (leeg / detected / reserved)

## Status — 2026-04-11

Software update flow structureel gerepareerd. Root cause dirty repo gevonden en opgelost. v1.0.60 getagd en gepusht. gbox-003, gbox-005, gbox-006 getriggerd naar v1.0.60. gbox-003 en gbox-005 hebben SSH nodig voor eenmalige handmatige reset (zie openstaande punten).

## Fixes 2026-04-11 — Structurele software update fix

### Root causes gevonden (dirty repo probleem)

- **`box_config.json` was getrackt in git** (commit `bbe2232`): elke runtime write maakte repo dirty → update blokkeerde
- **`src/test_connection.py` was getrackt in git**: lokaal gewijzigd op Pi → dirty
- **`src/__pycache__/db_manager.cpython-313.pyc` was getrackt in git bij bbe2232**: Python update dit bestand bij elke import → altijd dirty
- **v1.0.54 `ensure_repo_clean_for_checkout()` doet géén git reset**: gooit direct RuntimeError bij dirty repo, geen herstelpoging → kip-en-ei: Pi kon zichzelf niet updaten om de fix te krijgen
- **`ip route` zonder `-4` flag**: als Pi ook IPv6 routing heeft → geen IPv4 gateway gevonden → gatewayMac/Serial leeg
- **`latestGithub: error`**: git fetch --tags faalt op Pi, error gecacht voor 900s — nu retry na 60s

### Structurele fixes (v1.0.60)

- `git rm --cached box_config.json src/test_connection.py` — verwijderd uit git tracking, staan al in .gitignore
- `.gitignore` uitgebreid: `src/test_connection.py`, `runtime_config.json`, `src/__pycache__/`
- `ensure_repo_clean_for_checkout()` verbeterd:
  - git reset --hard HEAD zoals voorheen
  - Verwijdert nu ook alle `__pycache__/` directories na de reset
  - Accepteert `D`-status (deleted) .pyc bestanden — git checkout verwijdert ze sowieso
  - Gooit alleen RuntimeError bij niet-.pyc dirty files
- `get_latest_github_tag()`: kortere retry-TTL van 60s bij fout (was 900s)
- `get_gateway_ip()`: gebruikt `ip -4 route` in plaats van `ip route` — IPv4-only
- `RESET_AND_UPDATE` commando toegevoegd aan command handler

### Na v1.0.60 geldt voor nieuwe installaties

- `box_config.json` en `__pycache__/` zijn niet meer getrackt
- Repo blijft na opstart schoon
- Software updates werken automatisch zonder SSH

### Beperking voor gbox-003 en gbox-005 (v1.0.54)

Deze Pi's draaien v1.0.54 die géén git reset in `ensure_repo_clean_for_checkout()` heeft. Ze kunnen zichzelf NIET updaten naar v1.0.60 — ook niet met softwareUpdateRequested=true. SSH is vereist voor eenmalige handmatige reset:

```bash
cd /home/pi/dijkmans-gridbox-platform-next2
git reset --hard HEAD
git fetch --tags
# Pi pikt targetVersion=v1.0.60 op en update automatisch
```

Na die SSH-reset update de Pi automatisch dankzij `softwareUpdateRequested=true` in Firestore.

## Status — 2026-04-10

Provisioning flow end-to-end werkend en gevalideerd. Master image bijgewerkt naar v1.0.54c met correcte service-account.json. SD-script verwijst naar v1.0.54c. Bootstrap-init service geïnstalleerd op gbox-005. Verwijder knop toegevoegd aan provisioning overzicht.

## Architectuur (vastgelegd)

- frontend = `/gridbox-portal` (Firebase Hosting)
- backend = `/gridbox-api` (Cloud Run, europe-west1)
- device laag = root `/src` (`listener.py` op Raspberry Pi)
- `cloud-functions` = ondersteunend
- root `index.html` = legacy

## Architectuurbeslissingen

- RUT241 als standaard router voor alle installaties
- Teltonika RMS voor remote monitoring en remote access
- HTTP snapshots voor camera (geen RTSP)
- Operations Center = technisch beheer, Admin = klantbeheer
- Pi als tussenpersoon naar lokaal netwerk voor camera IP-detectie
- Magic Link + Google als loginmethodes (beide gelijkwaardig)
- platformAdmin heeft geen customerId nodig — bypass in requireCustomerContext

## Wat werkt

- Admin volledig: klanten, memberships, invites, rollen, provisioning flow end-to-end
- Sites endpoint gekoppeld aan klant (`/admin/sites`)
- Provisioning logs als live scherm met statuskleurcodering
- Bootstrap bestand (`box_bootstrap.json`) automatisch verwijderd na succesvolle claim
- Backend op Cloud Run (`gridbox-api`)
- Operations Center (`/operations`) live met RMS-integratie
  - Router status, signaal, operator, temperatuur, uptime, firmware per box
  - Credit vervaldatum waarschuwing (rood binnen 30 dagen)
  - RMS API token als Cloud Run environment variable
- formatDate omzet Firestore Timestamps correct naar leesbare datum
- Kopieer link knop in invite sectie
- Nieuwe site aanmaken via tekstveld als klant nog geen sites heeft
- gbox-006 succesvol geprovisioned via nieuwe bootstrap flow, status `ready`
- gbox-005 en gbox-006 draaien op listener v1.0.54 met bootstrap flow
- gbox-005 structuur gefixed als master referentie voor nieuwe installaties
- SD-script: 3-staps bootpartitie detectie (label → FAT32 fallback → handmatig met volumeoverzicht)
- SD-script: `service-account.json` automatisch gekopieerd naar bootpartitie vanuit `$PSScriptRoot`
- SD-script: I2C activering toegevoegd aan cloud-init (`raspi-config nonint do_i2c 0`, `dtparam=i2c_arm=on`, `modprobe i2c-dev`)
- Nieuwe installatie flow volledig automatisch: flash → bootstrap → claim → I2C → relais werken
- Bird SMS credentials (`BIRD_API_KEY`, `BIRD_WORKSPACE_ID`, `BIRD_CHANNEL_ID`, `BIRD_SMS_FROM`) toegevoegd aan Cloud Run
- Portal gedeployed naar Firebase Hosting: https://gridbox-platform.web.app
- Invite flow werkt end-to-end met SMS verificatie via Bird
- Design system vastgelegd in `docs/DESIGN_SYSTEM.md` (kleuren, typography, radius, componenten, stijlregels)
- Importeerbare TypeScript design tokens in `gridbox-portal/src/lib/design-tokens.ts`
- Bootstrap initialisatie volledig automatisch bij eerste opstart
- Geen manuele SSH of bestandskopieën meer nodig na flashen
- Magic Link (passwordless email) login naast Google login
- platformAdmin ziet alle boxen in portal (geen customerId nodig)
- Viewport meta tag + overflow-x hidden fix voor mobiel (iOS Safari)
- Camera beheer: discovery (device) + next-camera-ip / GET / PUT / snapshot (admin)
- Camera snapshot flow volledig gebouwd: Pi → GCS (`snapshots/{boxId}/`) → Firestore metadata → portal
- `/portal/box-picture` toont meest recente snapshot
- `/portal/box-events` toont box events overzicht
- Portal API: `/portal/boxes/:id/picture`, `/snapshots`, `/photos`, `/photos/content`
- `GET /portal/me` debug endpoint
- P0 safety fix v1.0.94: stale pending commands worden genegeerd bij listener startup
- Cloud Function `checkBoxHeartbeats`: automatische offline-detectie elke 5 minuten
- Watchdog (hardware, userspace) actief op Pi via update.sh en bootstrap

## Fixes 2026-04-10 (sessie 2)

- Camera DHCP beheer volledig gebouwd: GET/POST/DELETE /operations/boxes/:boxId/cameras
- IP automatisch voorgesteld uit range 192.168.10.100–249
- snapshotUrl automatisch berekend en weggeschreven naar hardware.camera.snapshotUrl op hoofddocument bij toevoegen én verwijderen camera
- Camera sectie toegevoegd aan Operations Center per box-kaart met lazy loading, inline formulier en verwijderknop
- 4 camera bugs gefixed in Operations Center (hang op loading, sectie klapte dicht, geen logging, auth header ontbrak)
- customerBoxAccess automatisch aangemaakt bij finalize-provisioning — nooit meer manueel
- SD-script slotmelding gefixed — leest boxId nu uit box_bootstrap.json variabele in plaats van hardcoded waarde
- Automatische rmsDeviceId koppeling via gateway serienummer (Teltonika API) met MAC-adres fallback (arp/ip neigh)
- latestGithub "error" blokkeert software updates niet meer — fallback naar targetVersion
- Software versie badge toegevoegd aan Operations Center — groen als op target, oranje met pijl als update beschikbaar
- gbox-003 succesvol geïnstalleerd met v1.0.56, bootstrap marker bug bevestigd opgelost
- gbox-003 customerBoxAccess manueel toegevoegd voor Powergrid bv (wordt voortaan automatisch gedaan)
- v1.0.57 getriggerd op gbox-003, gbox-005, gbox-006

## Fixes 2026-04-10

- Bootstrap marker probleem ontdekt en opgelost — `.bootstrap_initialized` marker werd meegenomen in master image, waardoor bootstrap op nieuwe boxen niet uitvoerde
- gbox-002 manueel gefixd via `rm .bootstrap_initialized` op de Pi
- Master image v1.0.56 aangemaakt zonder marker
- SD-script bijgewerkt naar v1.0.56 (was v1.0.55)
- Bug gefixd: INSTALLATIE sectie toonde verkeerd boxId
- Visuele substap-status toegevoegd aan stap 3 (SD-kaart flashen)
- Voortgangsbalk toegevoegd aan stap 3 (0% / 33% / 100%)
- Stap 4 (Eerste opstart) herbouwd: substappen met visuele status, live Pi-status indicator
- Stap 5 (Live controle) herbouwd: heartbeat tijd, listener versie, I2C/relais status
- `canFinalizeProvisioning` uitgebreid: nu ook actief bij status `ready`
- `listenerVersion` en `i2cStatus` toegevoegd aan `AdminProvisioningItem` type

## Fixes 2026-04-08

- `bootstrap-init` service geïnstalleerd op gbox-005
- `service-account.json` gecorrigeerd op gbox-005 (was verlopen)
- `runtime_config.json` aangemaakt voor gbox-005 met provisioning `U2DAv6yW7FIUiN0BYorh`
- Master image v1.0.54c aangemaakt met correcte service-account.json
- SD-script verwijst nu naar v1.0.54c (was 54b)
- Verwijder knop toegevoegd aan provisioning overzicht in admin
- `isPiOnline` fallback toegevoegd voor boxen zonder runtime_config

## Fixes 2026-04-07

- `gridbox-bootstrap-init.sh` en `gridbox-bootstrap-init.service` toegevoegd aan master image
- Script detecteert automatisch werkdirectory via `src/listener.py`
- Kopieert `box_bootstrap.json` en `service-account.json` van bootpartitie naar werkdirectory
- Genereert `box_config.json` automatisch vanuit `box_bootstrap.json`
- Marker `.bootstrap_initialized` voorkomt dubbele uitvoering

## Fixes 2026-04-06

- `mark-sd-prepared` accepteert nu ook status `awaiting_sd_preparation` naast `draft`
- Installatiecockpit stappen 5, 6 en 7 ontgrendelen als `provisioningExists` true is
- `canMarkSdPrepared` in frontend accepteert nu ook `awaiting_sd_preparation`
- "Installatie afronden" knop toegevoegd aan stap 6 (Eerste opstart)
- `listener_pi.py`: `traceback.print_exc()` toegevoegd in startup except
- `operations.ts`: `lastHeartbeatAt` veld opgehaald uit `software.lastHeartbeatIso` als fallback
- gbox-006: I2C ingeschakeld via raspi-config, relais werken nu correct
- Git tag `vv1.0.51` (typfout) verwijderd, correcte tag `v1.0.54` aangemaakt en gepusht
- `targetVersion` bijgewerkt naar `v1.0.54` voor gbox-005 en gbox-006 in Firestore

## Locatiemodel (vastgelegd)

- `sites` is de enige bron van waarheid voor locaties
- `boxes` verwijst via `siteId`
- legacy locatievelden op boxniveau zijn niet leidend

## Camera (vastgelegd)

- filtering op de Raspberry Pi (`should_store_snapshot()`)
- snapshots via HTTP GET op `snapshotUrl` met optionele BasicAuth
- interval configureerbaar via `snapshotIntervalSeconds` (default 5s)
- vergelijking via grijswaarden verschilscore met vorig opgeslagen beeld
- session start = box open (`open_start`), session end = box close (`open_end`) — altijd opgeslagen
- `startup_test` bij opstart listener — altijd opgeslagen
- `change_detected` tijdens sessie: score boven threshold én cooldown verstreken
- `force_save`: score boven `threshold × forceSaveThresholdMultiplier` — slaat op ook bij actieve cooldown
- geselecteerde beelden naar GCS: `snapshots/{boxId}/{filename}`
- Firestore subcollection `boxes/{boxId}/snapshots` bevat metadata per snapshot
- Portal: `/portal/box-picture` toont meest recente foto via `/portal/boxes/:id/picture`

## Openstaande punten (prioriteit)

1. ~~**Master image updaten naar v1.0.51**~~ — afgewerkt
2. ~~**SD-script bootpartitie detectie verbeteren**~~ — afgewerkt
3. ~~**`service-account.json` automatisch op SD-kaart zetten**~~ — afgewerkt
4. ~~**`ACTIVE_PORTAL_BOX_IDS` dynamisch maken**~~ — afgewerkt
5. ~~**I2C activeren via cloud-init in SD-script**~~ — afgewerkt
6. ~~**Invite flow end-to-end met SMS verificatie**~~ — afgewerkt
7. ~~**Magic Link login toevoegen**~~ — afgewerkt (2026-04-18)
8. ~~**PlatformAdmin ziet geen boxen in portal**~~ — afgewerkt (2026-04-18)
9. ~~**Mobiele viewport fix**~~ — afgewerkt (2026-04-18)
10. ~~**Camera beheer (discovery endpoint + admin GET/PUT/next-ip/snapshot)**~~ — afgewerkt (2026-04-18)
11. ~~**Installatiecockpit UI verbeteren: substappen en voortgangsindicatie**~~ — afgewerkt
12. `rmsDeviceId` koppelen aan alle bestaande boxes in Firestore
13. **Master image v1.0.56 upload naar GCS** — aangemaakt zonder bootstrap marker, nog niet volledig geupload
14. gbox-002 opnieuw testen met v1.0.56 image na voltooide GCS upload
15. gbox-003 en gbox-005: eenmalige SSH-reset nodig voor update naar v1.0.60
16. Remote acties: Pi herstarten, router herstarten via RMS
17. SIM saldo en dataverbruik via RMS
18. Operations Center uitbreiden met acties per box
19. **Operations Center:** boxes grafisch groeperen per router/locatie
20. **Automatische software updates op Pi:** bij nieuwe commit/release automatisch `softwareUpdateRequested` triggeren voor alle actieve boxes
21. v1.0.94 uitrollen naar alle overige boxes (gbox-006, gbox-007, etc.)
22. Oracle VPS 141.145.215.74 inzetten (doel nog te bepalen)
23. Hardware watchdog: systemd WatchdogSec implementeren (on hold tot na P0 uitrol)

## Regels

- niet verder bouwen op legacy frontend (root `index.html`)
- frontend blijft via API werken
- architectuur eerst respecteren, dan uitbreiden
- admin = klantbeheer, operations = technisch beheer
