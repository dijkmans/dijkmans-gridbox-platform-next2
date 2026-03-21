# dijkmans-gridbox-platform-next2

## Doel van deze repository
Deze repository bevat het volledige Gridbox platform, opgesplitst in duidelijke lagen:

- frontend (portal)
- backend (API)
- device/software (Raspberry Pi)
- ondersteunende cloud logica

De architectuur is bewust gescheiden om schaalbaarheid en onderhoud te garanderen.

## Architectuuroverzicht

### Frontend
- map: `/gridbox-portal`
- technologie: Next.js
- rol:
  - gebruikersinterface
  - admin interface
  - portal per klant, site en box

De frontend praat uitsluitend met de API.

### Backend
- map: `/gridbox-api`
- technologie: Node.js (Express)
- rol:
  - business logic
  - autorisatie
  - Firestore toegang
  - centrale beslissingslaag

De API is de enige toegangspoort tot Firestore voor business logic.

### Device / Raspberry Pi laag
- map: `/src` (root)
- technologie: Python
- rol:
  - listener
  - communicatie met Firestore
  - camera, sensoren en box-acties
  - lokale filtering op de Pi

Dit is de runtime code die effectief op de Gridbox draait.

### Legacy frontend
- root bestanden:
  - `index.html`
  - `404.html`

Deze zijn legacy en worden gefaseerd vervangen door de nieuwe portal.

### Onzekere of overgangszone
- map: `/web`

Status:
- niet leidend
- mogelijk legacy of experiment
- geen nieuwe ontwikkeling hier starten zonder expliciete beslissing

### Cloud Functions
- map: `/cloud-functions`

Rol:
- ondersteunende cloudlogica
- geen core business logic
- enkel gebruiken waar de API niet geschikt is of waar een trigger logisch is

## Huidige situatie

- Portal draait lokaal via `/gridbox-portal`
- Legacy frontend draait nog via Firebase Hosting in de repo-root
- API wordt gebruikt als centrale backend
- Device scripts draaien op Raspberry Pi via systemd service

## Belangrijke regels

- frontend praat nooit rechtstreeks met Firestore
- alle centrale logica zit in de API
- `/src` is exclusief voor device code
- `/gridbox-portal` is de enige frontend
- `/web` is onzeker of legacy
- root `index.html` is legacy

## Migratierichting

1. structuur stabiliseren
2. API volledig centraal maken
3. portal volledig laten overnemen van legacy
4. `/web` evalueren en waarschijnlijk archiveren of verwijderen
5. root frontend verwijderen zodra niet meer nodig
