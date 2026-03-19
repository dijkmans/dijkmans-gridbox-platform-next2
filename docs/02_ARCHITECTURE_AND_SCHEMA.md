# ARCHITECTURE & DATA MODEL

## Flow

Frontend -> API -> Firestore

## Collections

### customers

- id
- name
- active
- createdAt
- addedBy

### memberships

- email (uniek)
- customerId
- role
- createdAt / updatedAt

### boxes

- id
- boxId
- siteId
- customerId

### customerBoxAccess

Doc ID = customerId__boxId

- customerId
- boxId
- active
- updatedAt

### sites

`sites` is de enige bron van waarheid voor locaties.

Een site-document bevat de locatiegegevens van een fysieke locatie, bijvoorbeeld:

- id
- customerId
- name
- adresvelden

Locaties worden alleen hier aangemaakt en aangepast.

## API

- /admin/customers
- /admin/memberships
- /admin/customer-box-access
- /admin/boxes

## Security

- requirePlatformAdmin()
- role check via memberships

## Rules

- frontend geen Firestore
- API beslist alles

## Locatiemodel

### sites

`sites` is de enige bron van waarheid voor locaties.

Een site-document bevat de locatiegegevens van een fysieke locatie, bijvoorbeeld:

- id
- customerId
- name
- address / number / postalCode / city / country
- of een geneste location-structuur als dat later bewust zo gekozen wordt

Locaties worden alleen hier aangemaakt en aangepast.

### boxes

Een box-document verwijst naar een locatie via:

- boxId
- customerId
- siteId

Een box mag dus geen eigen losse locatie als bron van waarheid hebben.

Niet leidend:

- Portal.Site
- info.site
- site.name
- location.city

Deze velden zijn alleen legacy of fallback tijdens migratie.

## Migratierichting

Het gewenste model is:

- locatiebeheer in `sites`
- box verwijst via `siteId`
- `gbox-005` geldt als referentie voor het gewenste boxmodel

## Praktische afspraak

Voor nieuwe of gemigreerde boxen geldt:

- `boxes/{boxId}` bevat een expliciete `boxId`
- `boxes/{boxId}` bevat een expliciete `customerId`
- `boxes/{boxId}` bevat een expliciete `siteId`
- locatiegegevens zelf staan alleen in `sites/{siteId}`

De portal toont locaties op basis van `siteId` en de gekoppelde site in `sites`.