# ARCHITECTURE AND DATA MODEL

## Overzicht

Het Gridbox platform bestaat uit 3 kernlagen:

1. frontend -> `/gridbox-portal`
2. backend -> `/gridbox-api`
3. device -> `/src`

Ondersteunend:
- `/cloud-functions`
- legacy frontend in de repo-root
- `/web` als onzekere of legacy zone

## Hoofdregels

- frontend praat nooit rechtstreeks met Firestore
- API is de centrale toegang voor business logic en autorisatie
- device code in `/src` is operationeel en draait op de Raspberry Pi
- `/web` is niet leidend
- root `index.html` is legacy

## Flow

Frontend -> API -> Firestore  
Device -> Firestore voor operationele data en devicegedrag

## Collections

### customers
- id
- name
- active
- createdAt
- addedBy

### memberships
- email
- customerId
- role
- createdAt
- updatedAt

### sites
`sites` is de enige bron van waarheid voor locaties.

Velden:
- id
- customerId
- name
- address
- number
- postalCode
- city
- country

### boxes
Een box verwijst naar een locatie via `siteId`.

Velden:
- boxId
- customerId
- siteId

Niet leidend als locatiebron:
- `Portal.Site`
- `info.site`
- `site.name`
- `location.city`

### customerBoxAccess
- customerId
- boxId
- active
- updatedAt

## Device model

De Raspberry Pi code in `/src`:
- draait `listener.py`
- leest configuratie
- stuurt status updates
- verwerkt acties
- verwerkt camera en snapshots

`gridbox.service` start `src/listener.py` op de Pi.

`START_HIER.ps1` wordt gebruikt voor provisioning van nieuwe installaties en SD-kaarten.

## Camera architectuur

### Doel
Efficiënt capteren en opslaan van relevante camerabeelden tijdens een open sessie, met minimale opslag, upload en verwerking.

### Hoofdkeuze
De Raspberry Pi neemt frequent snapshots, filtert lokaal en slaat alleen relevante beelden op in Google Cloud Storage. Firestore bevat alleen metadata.

### Sessiemodel
Een sessie is één open-close cyclus van een box.

- `session start` = box open
- `session end` = box close
- elke sessie krijgt een unieke `sessionId`

### Capture logica
1. Bij openen van de box:
   - altijd een startfoto opslaan
   - `captureReason = open_start`

2. Tijdens open toestand:
   - snapshot elke 5 seconden
   - vergelijken met het laatst opgeslagen beeld
   - alleen opslaan bij betekenisvolle wijziging
   - `captureReason = change_detected`

3. Bij sluiten van de box:
   - altijd een eindfoto opslaan
   - `captureReason = open_end`

### Filtering op de Pi
Versie 1 blijft eenvoudig:
- beeld verkleinen
- omzetten naar grijswaarden
- verschil berekenen met het laatst opgeslagen beeld
- score vergelijken met een drempel
- cooldown toepassen tussen twee opgeslagen beelden
- een relevante beeldregio gebruiken waar mogelijk

### Storage
Google Cloud Storage:
- alleen geselecteerde beelden

Voorbeeldpad:
`/boxes/{boxId}/sessions/{sessionId}/{timestamp}.jpg`

Firestore:
- alleen metadata

Voorstel metadata velden:
- boxId
- sessionId
- timestamp
- storagePath
- diffScore
- captureReason

Mogelijke `captureReason` waarden:
- open_start
- change_detected
- open_end

### Portal weergave
Het portal toont per sessie een compacte tijdlijn:
- startbeeld
- relevante wijzigingsbeelden
- eindbeeld

Geen volledige ruwe reeks snapshots tonen.

## Migratierichting

- legacy locatievelden afbouwen
- `sites` verplicht maken als locatiebron
- boxen koppelen via `siteId`
- portal verder bouwen in `gridbox-portal`
- `/web` niet meer gebruiken als actieve richting
