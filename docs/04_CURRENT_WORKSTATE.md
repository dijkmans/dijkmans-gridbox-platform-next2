# CURRENT WORKSTATE

## Status — 2026-04-06

Provisioning flow end-to-end werkend en gevalideerd. gbox-005 en gbox-006 draaien op listener v1.0.54 met bootstrap flow. gbox-005 gefixed als master referentie. SD-script volledig geautomatiseerd: bootpartitie 3-staps detectie en service-account.json automatisch gekopieerd.

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

## Fixes 2026-04-06

- `mark-sd-prepared` accepteert nu ook status `awaiting_sd_preparation` naast `draft`,
  zodat `generate-script` en `mark-sd-prepared` samen in één flow werken
- Installatiecockpit stappen 5, 6 en 7 ontgrendelen als `provisioningExists` true is,
  onafhankelijk van stap 1 validatie (voorheen geblokkeerd bij direct laden van bestaand record)
- `canMarkSdPrepared` in frontend accepteert nu ook `awaiting_sd_preparation`
- "Installatie afronden" knop toegevoegd aan stap 6 (Eerste opstart)
- `listener_pi.py`: `traceback.print_exc()` toegevoegd in startup except voor betere foutdiagnose
- `operations.ts`: `lastHeartbeatAt` veld opgehaald uit `software.lastHeartbeatIso` als fallback

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
4. `rmsDeviceId` koppelen aan alle bestaande boxes in Firestore
5. Camera configuratie in installatiecockpit
6. Camera IP detectie via Pi als tussenpersoon (lokale RUT241 API)
7. Remote acties: Pi herstarten, router herstarten via RMS
8. SIM saldo en dataverbruik via RMS
9. Operations Center uitbreiden met acties per box
10. Portal deployen naar Firebase Hosting

## Regels

- niet verder bouwen op legacy frontend (`/web`, root `index.html`)
- frontend blijft via API werken
- architectuur eerst respecteren, dan uitbreiden
- admin = klantbeheer, operations = technisch beheer
