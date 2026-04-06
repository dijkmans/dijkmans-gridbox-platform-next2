# CURRENT WORKSTATE

## Status — 2026-04-06

Provisioning flow end-to-end werkend en gevalideerd. gbox-006 succesvol geprovisioned, status `ready`. Installatiecockpit stabiel. Volgende fase: master image updaten naar v1.0.51 met bootstrap flow, SD-script verbeteren, service-account.json automatiseren.

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

1. **Master image updaten naar v1.0.51** — huidig master image bevat nog niet de nieuwe bootstrap flow (`try_backend_bootstrap_claim`). `gridbox-api/listener_pi.py` is v1.0.53 maar mist de bootstrap claim logica. `src/listener.py` (v1.0.51) heeft de correcte flow. Master image moet gebrand worden met v1.0.51 of hoger mét bootstrap flow.
2. **SD-script bootpartitie detectie verbeteren** — het gegenereerde PS1-script wacht op een volume met label `bootfs` of `boot`, maar dat lukt niet altijd automatisch. Fallback naar handmatige letterinvoer werkt maar is foutgevoelig. Betere detectie of instructie nodig.
3. **`service-account.json` automatisch op SD-kaart zetten** — momenteel moet dit handmatig op de Pi gezet worden na eerste opstart. Het SD-script of de bootstrap flow moet dit automatiseren of de Pi moet het ophalen via de API na een geslaagde claim.
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
