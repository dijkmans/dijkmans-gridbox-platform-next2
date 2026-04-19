# GRIDBOX PLATFORM - MASTER CONTEXT

## Doel van het platform

Het Gridbox platform is een multi-tenant systeem waarmee klanten toegang krijgen tot fysieke Gridboxen.

Functionaliteit:
- gebruikers loggen in via Firebase Auth
- toegang wordt bepaald via memberships
- klanten krijgen toegang tot specifieke boxen
- boxen kunnen geopend worden via het platform
- monitoring en device communicatie lopen mee in dezelfde architectuur

## Architectuur (verplicht model)

### Frontend
- locatie: `/gridbox-portal`
- technologie: Next.js
- gedeployed op: Firebase Hosting (`https://gridbox-platform.web.app`)
- praat met: API

De frontend bevat:
- portal (boxoverzicht, cockpit, toegangsbeheer)
- admin (klantbeheer, memberships, invites, provisioning)
- operations center (technisch beheer, RMS, hardware)
- activatie-flow (`/activate-invite`)

### Backend
- locatie: `/gridbox-api`
- technologie: Node.js (Express)
- gedeployed op: Google Cloud Run (`europe-west1`)
- praat met: Firestore

De backend:
- beheert alle business logic
- doet alle autorisatie
- is de enige centrale toegang tot Firestore voor platformfunctionaliteit

### Device laag
- locatie: `/src`
- technologie: Python
- runtime: Raspberry Pi

De device laag:
- draait `listener.py`
- verwerkt box acties
- stuurt status naar Firestore
- verwerkt camera en sensoren
- doet filtering van camerabeelden lokaal op de Pi

### Ondersteunende lagen

#### Cloud Functions
- ondersteunend
- niet leidend
- alleen gebruiken voor specifieke cloudtaken of triggers

#### Legacy frontend
- root `index.html`
- root `404.html`
- legacy en niet meer leidend

## Autorisatiemodel

Membership per email:
- email
- authUid
- customerId
- role
- phoneNumber
- phoneVerified

Roles (volledig):
- `platformAdmin` — volledige platformtoegang, ziet alle boxen in de portal
- `customerAdmin` — beheert klant, leden en toegang
- `customerOperator` — kan box bedienen, heeft cameratoegang
- `customerOperatorNoCamera` — kan box bedienen, geen cameratoegang
- `customerViewer` — alleen-lezen toegang

Bijzonderheid platformAdmin:
- `requireCustomerContext` slaat de `customerId`-check over voor platformAdmin
- platformAdmin ziet alle boxen in `/portal/boxes` zonder `customerBoxAccess` filter

## Login methodes

Twee methodes worden ondersteund via Firebase Authentication:
1. **Google login** — via `signInWithPopup` met Google provider
2. **Magic Link (passwordless email)** — via `sendSignInLinkToEmail` en `isSignInWithEmailLink`

Beide methodes zijn actief in Firebase Console (Email/Password + Email link).

Magic Link gebruikt `magicLinkSettings` in `firebase.ts` met `handleCodeInApp: true`.

Login is aanwezig in:
- `AuthPanel.tsx` (portal en admin)
- `activate-invite/page.tsx` (stap 1 van activatiefunnel)

## Belangrijk principe

Frontend -> API -> Firestore

Niet toegelaten:
Frontend -> Firestore

## Beheerlagen

### Admin (`/admin`)
- klantbeheer
- memberships, invites, rollen
- provisioning en installatiecockpit
- stabiel en werkend

### Operations Center (`/operations`)
- technisch beheer
- real-time status alle boxen
- netwerk, hardware, remote acties
- Teltonika RMS integratie
- SIM saldo en dataverbruik

## Camera architectuur (samenvatting)

De Raspberry Pi neemt snapshots en filtert lokaal. Alleen relevante beelden gaan naar GCS.

Sessiemodel: één open-close cyclus = één sessie met unieke `session_id`.

Phases / captureReason:
- `startup_test` — bij opstart listener
- `open_start` — bij openen box (altijd opgeslagen)
- `open_end` — bij sluiten box (altijd opgeslagen)
- `change_detected` — tijdens open sessie bij significante wijziging

storeReason waarden: `forced_phase` / `change_detected` / `force_save` / `below_threshold` / `cooldown_active`

Opslaginrichtingen:
- GCS: `snapshots/{boxId}/{filename}` — alleen geselecteerde beelden
- Firestore: `boxes/{boxId}/snapshots` — alleen metadata

Camera config in Firestore (`hardware.camera`):
- `snapshotIntervalSeconds` (default 5)
- `changeDetectionThreshold` (default 6.0)
- `saveCooldownSeconds` (default 10)
- `forceSaveThresholdMultiplier` (default 2.0)
- `postCloseSnapshotDurationSeconds` (default 30)

Portal API voor snapshots:
- `GET /portal/boxes/:id/picture` — meest recente foto als blob
- `GET /portal/boxes/:id/snapshots` — metadata lijst uit Firestore
- `GET /portal/boxes/:id/photos` — bestandslijst uit GCS
- `GET /portal/boxes/:id/photos/content` — bestand uit GCS als blob

## Huidige focus

- Admin en portal zijn stabiel en werkend
- Invite flow end-to-end werkend met SMS verificatie via Bird API
- Camera snapshot flow volledig gebouwd (Pi → GCS → portal)
- Volgende fase: Operations Center uitbreiden

## Design System

Alle UI-stijlen zijn vastgelegd in `docs/DESIGN_SYSTEM.md`.

**Regel**: alle nieuwe UI-componenten en pagina's moeten de stijlregels uit `DESIGN_SYSTEM.md` volgen. Gebruik `gridbox-portal/src/lib/design-tokens.ts` voor importeerbare TypeScript constanten.

Samenvatting van de kernregels:
- Hoofdcards altijd `rounded-3xl`, sub-cards `rounded-2xl`, knoppen en inputs `rounded-xl`
- Sidebar altijd `bg-slate-900`
- Alerts: amber voor waarschuwingen, blauw voor informatie — nooit rood
- Tekst: `text-slate-900` (titels), `text-slate-600` (body), `text-slate-500` (labels)

## Regel

Niet verder bouwen voor de architectuur duidelijk blijft. Admin en Operations Center zijn bewust gescheiden lagen.
