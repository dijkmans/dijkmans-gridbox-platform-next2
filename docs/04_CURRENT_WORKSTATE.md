# CURRENT WORKSTATE

## Status

- admin werkt
- dropdowns werken
- API is de centrale backend
- basisarchitectuur is vastgelegd

## Architectuur (vastgelegd)

- frontend = `/gridbox-portal`
- backend = `/gridbox-api`
- device laag = root `/src`
- `cloud-functions` = ondersteunend
- root `index.html` = legacy
- `/web` = onzeker of legacy en niet leidend

## Problemen

- memberships kunnen overschreven worden
- duplicate preventie ontbreekt of is onvoldoende
- delete en deactivate zijn nog niet voldoende uitgewerkt
- UI validatie moet sterker

## Regels

- niet verder bouwen op de verkeerde frontend
- geen nieuwe features in `/web`
- geen nieuwe platformfunctionaliteit in root `index.html`
- frontend blijft via API werken
- architectuur eerst respecteren, dan uitbreiden

## Locatiemodel (vastgelegd)

- `sites` is de enige bron van waarheid voor locaties
- `boxes` verwijst via `siteId`
- legacy locatievelden op boxniveau zijn niet leidend

## Huidige richting camera

Vastgelegd:
- filtering gebeurt op de Raspberry Pi
- snapshots worden genomen elke 5 seconden
- vergelijking gebeurt altijd met het laatst opgeslagen beeld
- `session start` = box open
- `session end` = box close
- startbeeld wordt altijd opgeslagen
- eindbeeld wordt altijd opgeslagen
- tussenbeelden worden alleen opgeslagen bij betekenisvolle wijziging
- alleen geselecteerde beelden gaan naar Google Cloud Storage
- Firestore bevat alleen metadata

Nog uit te werken:
1. exacte diff threshold
2. exacte cooldownwaarde
3. keuze hoe strikt ROI in v1 wordt toegepast
4. foutafhandeling bij uploadproblemen
5. definitieve Firestore-structuur voor sessies en captures
6. portal-tijdlijn per sessie

## Volgende stappen

1. platformAdmin beschermen
2. duplicates blokkeren
3. UI valideren
4. data model verder opschonen via `sites` en `boxes`
5. camera-architectuur implementeren in `listener.py`
6. legacy en twijfelzones uit de actieve lijn halen

## Belangrijk inzicht

Als deze structuur niet gerespecteerd wordt, verlies je richting in code, data en documentatie.

Dus:
eerst structuur, dan features
