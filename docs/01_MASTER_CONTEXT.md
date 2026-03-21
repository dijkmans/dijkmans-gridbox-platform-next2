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

## Huidige focus

- admin stabiliseren
- duplicates voorkomen
- platformAdmin beschermen
- data model correct zetten via `sites` en `boxes`
- camera-architectuur correct opnemen in device en portal

## Regel

Niet verder bouwen voor admin stabiel is en de architectuur duidelijk blijft.
