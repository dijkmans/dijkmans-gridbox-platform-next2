# DECISIONS LOG

## API tussen frontend en Firestore

- gekozen voor security en controle

## Eén membership per email

- eenvoudig maar risico op overschrijven

## customer.active

- globale switch voor toegang

## customerBoxAccess apart

- flexibel en schaalbaar

## Doc ID = customerId__boxId

- voorkomt duplicaten

## Roles

- platformAdmin
- customerAdmin
- viewer

## Shares niet voor portal access

- andere use case

## 2026-03-19 - Sites as single source of truth

Beslissing:

Locaties worden uitsluitend beheerd in de Firestore collection `sites`.

Afspraken:

- `sites` is de enige plaats waar locaties aangemaakt en aangepast worden
- `boxes` bevat alleen een verwijzing via `siteId`
- op boxniveau mag geen losse locatie-logica meer leidend zijn
- legacy velden zoals `Portal.Site`, `info.site`, `site.name` en `location.city` zijn alleen tijdelijke fallback en niet de bron van waarheid

Gevolgen:

- nieuwe en gemigreerde boxen moeten een expliciete `siteId` hebben
- de portal moet locaties tonen op basis van `sites`
- Raspberry Pi bootstrap mag een `siteId` gebruiken, maar locaties horen niet organisch op boxniveau beheerd te worden
- oude boxdata moet stap voor stap gemigreerd worden naar het model met expliciete `customerId` en `siteId`

Referentie:

- `gbox-005` geldt als referentie voor het gewenste boxmodel
