# CURRENT WORKSTATE

## Status — 2026-04-10

Provisioning flow end-to-end werkend en gevalideerd. Master image bijgewerkt naar v1.0.54c met correcte service-account.json. SD-script verwijst naar v1.0.54c. Bootstrap-init service geïnstalleerd op gbox-005. Verwijder knop toegevoegd aan provisioning overzicht.

## Architectuur (vastgelegd)

- frontend = `/gridbox-portal`
- backend = `/gridbox-api` (draait op Cloud Run)
- device laag = root `/src` (`listener.py` op Raspberry Pi)
- `cloud-functions` = ondersteunend
- root `index.html` = legacy
- `/web` = legacy, niet leidend

## Architectuurbeslissingen

- RUT241 als standaard router voor alle installaties
- Teltonika RMS voor remote monitoring en remote access
- HTTP snapshots voor camera (geen RTSP)
- Operations Center = technisch beheer, Admin = klantbeheer
- Pi als tussenpersoon naar lokaal netwerk voor camera IP-detectie

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
- gbox-006 toegevoegd aan `ACTIVE_PORTAL_BOX_IDS` in `boxes.ts`
- Invite flow werkt end-to-end met SMS verificatie via Bird
- Design system vastgelegd in `docs/DESIGN_SYSTEM.md` (kleuren, typography, radius, componenten, stijlregels)
- Importeerbare TypeScript design tokens in `gridbox-portal/src/lib/design-tokens.ts`
- Bootstrap initialisatie volledig automatisch bij eerste opstart
- Geen manuele SSH of bestandskopieën meer nodig na flashen

## Fixes 2026-04-10

- Bootstrap marker probleem ontdekt en opgelost — `.bootstrap_initialized` marker werd meegenomen in master image, waardoor bootstrap op nieuwe boxen niet uitvoerde
- gbox-002 manueel gefixd via `rm .bootstrap_initialized` op de Pi
- Master image v1.0.56 aangemaakt zonder marker
- Upload v1.0.56 naar GCS bezig
- SD-script bijgewerkt naar v1.0.56 (was v1.0.55)
- Bug gefixd: INSTALLATIE sectie toonde verkeerd boxId — `fetchProvisioningById` synchroniseerde `provisioningBoxId` niet, waardoor oude formulierwaarde zichtbaar bleef
- Visuele substap-status toegevoegd aan stap 3 (SD-kaart flashen): grijs/blauw pulsend/groen vinkje per substap op basis van `hasBootstrapDownloadItem` en `sdMarked`
- Voortgangsbalk toegevoegd aan stap 3 (0% / 33% / 100%)
- Stap 4 (Eerste opstart) herbouwd: substappen met visuele status, live Pi-status indicator (wachten/claimed/online)
- Stap 5 (Live controle) herbouwd: heartbeat tijd, listener versie, I2C/relais status, "Installatie afronden" alleen actief bij `online` of `ready`
- `canFinalizeProvisioning` uitgebreid: nu ook actief bij status `ready` (was alleen `online`)
- `listenerVersion` en `i2cStatus` toegevoegd aan `AdminProvisioningItem` type en normalizer — klaar voor backendkoppeling

## Fixes 2026-04-08

- `bootstrap-init` service geïnstalleerd op gbox-005
- `service-account.json` gecorrigeerd op gbox-005 (was verlopen)
- `runtime_config.json` aangemaakt voor gbox-005 met provisioning `U2DAv6yW7FIUiN0BYorh`
- Master image v1.0.54c aangemaakt met correcte service-account.json
- Upload v1.0.54c naar GCS gestart (nog bezig)
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

- `mark-sd-prepared` accepteert nu ook status `awaiting_sd_preparation` naast `draft`,
  zodat `generate-script` en `mark-sd-prepared` samen in één flow werken
- Installatiecockpit stappen 5, 6 en 7 ontgrendelen als `provisioningExists` true is,
  onafhankelijk van stap 1 validatie (voorheen geblokkeerd bij direct laden van bestaand record)
- `canMarkSdPrepared` in frontend accepteert nu ook `awaiting_sd_preparation`
- "Installatie afronden" knop toegevoegd aan stap 6 (Eerste opstart)
- `listener_pi.py`: `traceback.print_exc()` toegevoegd in startup except voor betere foutdiagnose
- `operations.ts`: `lastHeartbeatAt` veld opgehaald uit `software.lastHeartbeatIso` als fallback
- gbox-006: I2C ingeschakeld via raspi-config, relais werken nu correct
- Git tag `vv1.0.51` (typfout) verwijderd, correcte tag `v1.0.54` aangemaakt en gepusht
- `targetVersion` bijgewerkt naar `v1.0.54` voor gbox-005 en gbox-006 in Firestore

## Locatiemodel (vastgelegd)

- `sites` is de enige bron van waarheid voor locaties
- `boxes` verwijst via `siteId`
- legacy locatievelden op boxniveau zijn niet leidend

## Camera (vastgelegd)

- filtering op de Raspberry Pi
- snapshots elke 5 seconden
- vergelijking altijd met het laatst opgeslagen beeld
- session start = box open, session end = box close
- start- en eindbeelden altijd opgeslagen
- tussenbeelden alleen bij betekenisvolle wijziging
- geselecteerde beelden naar Google Cloud Storage
- Firestore bevat alleen metadata

## Openstaande punten (prioriteit)

1. ~~**Master image updaten naar v1.0.51**~~ — afgewerkt: gbox-005 en gbox-006 draaien op v1.0.54 met bootstrap flow
2. ~~**SD-script bootpartitie detectie verbeteren**~~ — afgewerkt: 3-staps detectie (label → FAT32 → handmatig met volumeoverzicht)
3. ~~**`service-account.json` automatisch op SD-kaart zetten**~~ — afgewerkt: SD-script kopieert automatisch vanuit `$PSScriptRoot`
4. ~~**`ACTIVE_PORTAL_BOX_IDS` dynamisch maken**~~ — afgewerkt: whitelist verwijderd, toegang loopt nu volledig via `customerBoxAccess` in Firestore
5. ~~**I2C activeren via cloud-init in SD-script**~~ — afgewerkt: cloud-init bevat nu `raspi-config nonint do_i2c 0` en `dtparam=i2c_arm=on`
6. `rmsDeviceId` koppelen aan alle bestaande boxes in Firestore
7. Camera configuratie in installatiecockpit
8. **Camera IP beheer via RUT241 DHCP static leases:**
   - MAC adres per camera opslaan in Firestore
   - Volgende vrije IP automatisch voorstellen (range 192.168.10.100–249)
   - Static lease aanmaken via RMS API
   - `snapshotUrl` automatisch updaten in Firestore
   - Beheer vanuit admin panel per box
9. Remote acties: Pi herstarten, router herstarten via RMS
10. SIM saldo en dataverbruik via RMS
11. Operations Center uitbreiden met acties per box
12. **Master image v1.0.56 upload naar GCS nog bezig** — aangemaakt zonder bootstrap marker, nog niet volledig geupload
13. ~~**Installatiecockpit UI verbeteren: substappen en voortgangsindicatie**~~ — afgewerkt: stap 3 voortgangsbalk + substap-status, stap 4 live Pi-status, stap 5 heartbeat/versie/I2C
14. gbox-002 opnieuw testen met v1.0.56 image na voltooide GCS upload
15. Camera DHCP beheer via RUT241 static leases
16. **Automatische `rmsDeviceId` koppeling:** Pi detecteert gateway MAC-adres bij heartbeat → API matcht met RMS device lijst op serienummer (via lokale router API `GET http://{gateway}/api/v1/system/board`) → `rmsDeviceId` automatisch ingevuld in Firestore
17. **Operations Center:** boxes grafisch groeperen per router/locatie
18. **Automatische software updates op Pi:** bij nieuwe commit/release automatisch `softwareUpdateRequested` triggeren voor alle actieve boxes
19. **Operations Center:** toon software versie per box, badge "Update beschikbaar" als Pi niet op laatste versie zit

## Regels

- niet verder bouwen op legacy frontend (`/web`, root `index.html`)
- frontend blijft via API werken
- architectuur eerst respecteren, dan uitbreiden
- admin = klantbeheer, operations = technisch beheer
