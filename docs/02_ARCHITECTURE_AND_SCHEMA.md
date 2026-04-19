# ARCHITECTURE AND DATA MODEL

## Overzicht

Het Gridbox platform bestaat uit 3 kernlagen:

1. frontend -> `/gridbox-portal`
2. backend -> `/gridbox-api`
3. device -> `/src`

Ondersteunend:
- `/cloud-functions`
- legacy frontend in de repo-root

## Hoofdregels

- frontend praat nooit rechtstreeks met Firestore
- API is de centrale toegang voor business logic en autorisatie
- device code in `/src` is operationeel en draait op de Raspberry Pi
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

Velden:
- id
- authUid
- email
- displayName
- phoneNumber
- phoneVerified
- customerId
- role
- active
- invitedByAuthUid
- inviteId
- createdAt
- activatedAt
- updatedAt

Toelichting:
- membership wordt aangemaakt na volledige activatie via invite-flow
- `authUid` is de koppeling naar Firebase Authentication
- `phoneVerified` wordt `true` na succesvolle Bird SMS verificatie
- lookup in de API gebeurt op `email` (via `getMembershipByEmail`)
- `platformAdmin` heeft geen `customerId` — slaat de customercontext-check over

### invites

Velden:
- id
- email
- displayName
- customerId
- role
- tokenHash
- expiresAt
- status (`pending` / `accepted` / `expired` / `revoked`)
- createdByAuthUid
- createdAt
- acceptedAt
- acceptedByAuthUid
- phoneNumber
- phoneVerified
- phoneVerification (object):
  - status
  - codeHash
  - expiresAt
  - attemptCount
  - lastSentAt

Toelichting:
- raw token wordt nooit opgeslagen, alleen `tokenHash` (SHA-256)
- SMS verificatie loopt via Bird API (niet Firebase Auth phone verification)
- `phoneVerification.codeHash` is de hash van de verzonden sms-code

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

Velden (kern):
- boxId
- customerId
- siteId
- status
- updatedAt
- hardware (object):
  - camera (object):
    - mac
    - ip
    - detectedIp
    - suggestedIp
    - detectionStatus (`detected` / `ip_suggested` / `reserved`)
    - snapshotUrl
    - detectedAt
    - reservedAt
    - enabled
    - username
    - password
    - snapshotIntervalSeconds (default 5)
    - changeDetectionThreshold (default 6.0)
    - saveCooldownSeconds (default 10)
    - forceSaveThresholdMultiplier (default 2.0)
    - postCloseSnapshotDurationSeconds (default 30)
  - lights (object)
  - shutter (object)
  - rmsDeviceId
- software (object):
  - currentVersion
  - lastHeartbeatIso
- state (object):
  - lastHeartbeatAt
- gatewayMac
- gatewayIp

Niet leidend als locatiebron:
- `Portal.Site`
- `info.site`
- `site.name`
- `location.city`

### customerBoxAccess
- customerId
- boxId
- active
- addedBy
- updatedAt

Wordt automatisch aangemaakt bij `finalize-provisioning`.

### boxes/{boxId}/snapshots (subcollection)

Firestore metadata per opgeslagen snapshot.

Velden:
- snapshotId
- boxId
- sessionId
- sessionStartedAt
- filename
- storagePath (`snapshots/{boxId}/{filename}`)
- bucket
- capturedAt
- phase (`startup_test` / `open_start` / `open_end` / `change_detected`)
- captureReason
- storeReason (`forced_phase` / `change_detected` / `force_save` / `below_threshold` / `cooldown_active`)
- sequenceNumber
- changeDetected
- changeScore
- changeThreshold
- previousSnapshotId
- contentType
- sizeBytes
- width
- height
- boxWasOpen
- source
- createdAt
- updatedAt

### provisionings

Velden:
- id
- boxId
- customerId
- siteId
- status (`draft` / `awaiting_sd_preparation` / `awaiting_first_boot` / `claimed` / `online` / `ready` / `failed`)
- bootstrapTokenHash
- createdAt
- createdBy
- claimedAt
- claimedByDevice
- lastHeartbeatAt
- lastError
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

### Camera onboarding flow (admin)

1. Raspberry Pi detecteert camera op het netwerk → `POST /device/camera/discovery` met `{ boxId, macAddress, detectedIp }` → `detectionStatus = "detected"` (in `device.ts`)
2. Admin vraagt vrij IP op via `GET /admin/boxes/next-camera-ip`
3. Admin slaat camera op via `PUT /admin/boxes/:boxId/camera` met `{ mac, ip, username, password }` → `snapshotUrl` automatisch berekend

UI in `AdminBoxConfigClient.tsx`: conditioneel blok per `detectionStatus` (leeg / detected / reserved).

### Sessiemodel
Een sessie is één open-close cyclus van een box.

- `session_id` aangemaakt bij box open
- sessie beëindigd bij box dicht
- elk snapshot krijgt `sessionId` en `sequenceNumber`

### Device-kant (src/listener.py)

`take_snapshot()`: haalt JPEG op via HTTP van `snapshotUrl` met optionele `HTTPBasicAuth` (username/password).

`analyze_snapshot_change()`: verkleint beeld, grijswaarden, berekent verschilscore ten opzichte van vorig opgeslagen beeld.

`should_store_snapshot()` beslist op basis van:
- **forced phases** (`startup_test`, `open_start`, `open_end`) → altijd opslaan
- **change_detected**: score boven threshold én cooldown verstreken → opslaan
- **force_save**: score boven `threshold × forceSaveThresholdMultiplier` → opslaan ook al is cooldown nog actief
- **cooldown_active**: te snel na vorig beeld → overslaan

Upload naar GCS: `snapshots/{boxId}/{filename}`

Firestore metadata: subcollection `boxes/{boxId}/snapshots` (zie schema hierboven)

### Phases / captureReason waarden
- `startup_test` — bij opstart listener
- `open_start` — bij openen box (altijd opgeslagen)
- `open_end` — bij sluiten box (altijd opgeslagen)
- `change_detected` — tijdens open sessie bij significante wijziging

storeReason: `forced_phase` / `change_detected` / `force_save` / `below_threshold` / `cooldown_active`

### Storage

Google Cloud Storage:
- pad: `snapshots/{boxId}/{filename}`
- alleen geselecteerde beelden

Firestore:
- subcollection `boxes/{boxId}/snapshots`
- alleen metadata (zie schema)

### Admin API endpoints (camera) — admin.ts

- `GET /admin/boxes/next-camera-ip` — zoekt eerste vrij IP in `192.168.10.100–249` door alle `hardware.camera.ip` in Firestore te vergelijken. Fout `NO_IP_AVAILABLE` als range vol.
- `GET /admin/boxes/:boxId/camera` — haalt camera config op uit `hardware.camera`
- `PUT /admin/boxes/:boxId/camera` — slaat camera op: valideert IP range, berekent `snapshotUrl` automatisch als `http://{ip}/cgi-bin/snapshot.cgi`, schrijft `mac` / `ip` / `snapshotUrl` / `username` / `password` / `updatedAt` naar `hardware.camera.*`
- `GET /admin/boxes/:boxId/camera/snapshot` — haalt live snapshot op via `snapshotUrl` met optionele Basic Auth (`username` / `password` uit Firestore)

Al deze endpoints zitten in `gridbox-api/src/routes/admin.ts` (niet in operations.ts) en vereisen `requirePlatformAdmin`.

### Portal API endpoints (camera) — boxes.ts

- `GET /portal/boxes/:id/picture` — haalt meest recente foto uit GCS, serveert als blob
- `GET /portal/boxes/:id/snapshots` — metadata lijst uit Firestore (optioneel: startDate, endDate, limit)
- `GET /portal/boxes/:id/photos` — bestandslijst uit GCS met prefix `snapshots/{boxId}/`
- `GET /portal/boxes/:id/photos/content` — serveert bestand uit GCS als blob (inline weergave)

### Portal frontend
- `/portal/box-picture/page.tsx` — toont meest recente snapshot via `/portal/boxes/:id/picture`
- `/portal/box-events/page.tsx` — box events overzicht

## Migratierichting

- legacy locatievelden afbouwen
- `sites` verplicht maken als locatiebron
- boxen koppelen via `siteId`
- portal verder bouwen in `gridbox-portal`

## Technische uitwerking invite-procedure

De uitvoerbare procedure voor invites en activatie staat verder uitgewerkt in:

- `docs/05_INVITE_PROCEDURE.md`

Deze procedure is leidend voor:

- Firestore datamodel van invites en memberships
- API-endpoints voor invite create, validate en accept
- activatieflow in de portal
- koppeling van membership aan `authUid`
