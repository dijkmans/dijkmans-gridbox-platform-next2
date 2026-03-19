# CURRENT WORKSTATE

## Status

- admin werkt
- dropdowns werken
- API stabiel

## Problemen

- membership overschrijven
- geen duplicate preventie UI
- geen delete/deactivate

## Relevante files

- admin/page.tsx
- routes/admin.ts

## Volgende stappen

1. platformAdmin beschermen
2. UI validatie verbeteren
3. duplicates blokkeren
4. admin uitbreiden

## Regel

Niet verder bouwen voor admin stabiel is

## 2026-03-19 - Huidige richting locaties

Vastgelegd:

- `sites` is de enige bron van waarheid voor locaties
- `boxes` verwijst alleen via `siteId`
- `gbox-005` is referentie voor het gewenste boxmodel
- legacy velden op boxniveau zijn niet leidend

Eerstvolgende focus:

1. bestaande boxen inventariseren en per box juiste `siteId` bepalen
2. oude boxdocs migreren naar expliciete `customerId` en `siteId`
3. pas daarna portal-overzicht per locatie bouwen
4. fallbacklogica later afbouwen