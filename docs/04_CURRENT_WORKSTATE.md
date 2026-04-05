# CURRENT WORKSTATE

## Status

Admin fase is stabiel en werkend. Volgende fase is Operations Center en RMS-integratie.

## Architectuur (vastgelegd)

- frontend = `/gridbox-portal`
- backend = `/gridbox-api` (draait op Cloud Run)
- device laag = root `/src` (`listener.py` op Raspberry Pi)
- `cloud-functions` = ondersteunend
- root `index.html` = legacy
- `/web` = legacy, niet leidend

## Wat werkt

- Admin volledig: klanten, memberships, invites, rollen, provisioning flow end-to-end
- Sites endpoint gekoppeld aan klant (`/admin/sites`)
- Provisioning logs als live scherm met statuskleurcodering
- Bootstrap bestand (`box_bootstrap.json`) wordt automatisch verwijderd na succesvolle claim
- Backend op Cloud Run (`gridbox-api`)
- formatDate omzet Firestore Timestamps correct naar leesbare datum
- Kopieer link knop in invite sectie
- Nieuwe site aanmaken via tekstveld als klant nog geen sites heeft

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

## Volgende stappen

1. Operations Center (`/operations`) — real-time status alle boxen, netwerk, hardware, remote acties, kosten
2. Teltonika RMS integratie — camera IP detectie en remote access als Pi uitvalt
3. Camera configuratie in installatiecockpit via RMS
4. SIM saldo en dataverbruik inzichtelijk maken

## Regels

- niet verder bouwen op legacy frontend (`/web`, root `index.html`)
- frontend blijft via API werken
- architectuur eerst respecteren, dan uitbreiden
- admin = klantbeheer, operations = technisch beheer
