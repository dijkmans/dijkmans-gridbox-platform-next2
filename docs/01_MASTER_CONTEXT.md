# GRIDBOX PLATFORM - MASTER CONTEXT

## Doel van het project
Het Gridbox platform is een multi-tenant systeem waarmee klanten toegang krijgen tot fysieke Gridboxen.

Functionaliteit:
- gebruikers loggen in via Firebase Auth
- backend bepaalt toegang via memberships
- klanten krijgen toegang tot specifieke boxen
- boxen kunnen geopend worden via het platform

Het platform moet schaalbaar zijn naar meerdere klanten en sites.

## Tech stack
Frontend:
- Next.js (App Router)
- Firebase Auth

Backend:
- Node.js (Express)
- Cloud Run (target)
- Firebase Admin SDK

Database:
- Firestore

## Architectuur
Frontend ? API ? Firestore

Belangrijk:
- frontend praat NOOIT rechtstreeks met Firestore
- alle security zit in de API

## Autorisatiemodel
1 membership per email:
- email ? membership

Membership:
- email
- customerId
- role

Roles:
- platformAdmin ? alles
- customerAdmin ? eigen customer
- viewer ? lezen

Extra:
- customer.active bepaalt toegang
- customerBoxAccess bepaalt box-toegang

## Huidige status
? Admin pagina werkt
? Customers CRUD
? Memberships CRUD (overschrijft bestaande email)
? Customer-box koppeling werkt
? Dropdowns werken

## Volgende stap
- UI beschermen tegen overschrijven van platformAdmin
- duplicate preventie
