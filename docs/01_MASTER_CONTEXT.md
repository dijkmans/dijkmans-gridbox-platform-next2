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
- praat met: API

De frontend bevat:
- portal
- admin
- box-weergave
- sessie- en gebruikersinteractie

### Backend
- locatie: `/gridbox-api`
- technologie: Node.js (Express)
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

#### `/web`
- onduidelijk
- niet gebruiken voor nieuwe features
- behandelen als onzeker of legacy tot expliciete beslissing

## Autorisatiemodel

Membership per email:
- email
- customerId
- role

Roles:
- platformAdmin
- customerAdmin
- viewer

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
- volgende fase

## Huidige focus

- Admin fase is stabiel en werkend
- Volgende fase: Operations Center en RMS integratie
- Twee aparte beheerlagen: admin (klanten) en operations (technisch)

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
