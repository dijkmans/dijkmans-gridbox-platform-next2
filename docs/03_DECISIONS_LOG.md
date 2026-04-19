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

Actuele rollenset:
- platformAdmin
- customerAdmin
- customerOperator
- customerOperatorNoCamera
- customerViewer

(`viewer` is een verouderde naam, niet meer in gebruik)

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

## 2026-03-22 - Invite-procedure technisch vastgezet

Beslissing:

De invite-flow wordt niet alleen conceptueel maar ook technisch vastgelegd in een apart document.

Referentie:

- `docs/05_INVITE_PROCEDURE.md`

Afspraken:

- invite en membership blijven gescheiden entiteiten
- raw invite token wordt niet opgeslagen, alleen hash
- acceptatie vereist login via Firebase Authentication
- acceptatie vereist e-mailmatch met invite
- acceptatie vereist verplichte gsm-verificatie via Bird SMS
- autorisatie gebeurt op actieve membership gekoppeld aan `authUid`

Gevolg:

nieuwe implementatie van admin en portal moet deze procedure volgen

## 2026-04-05 - Hardware en remote management vastgelegd

### RUT241 als standaard router

Beslissing: de RUT241 van Teltonika is de standaard router voor alle Gridbox installaties.

Gevolgen:
- elke installatie heeft een bekende routerhardware met vaste mogelijkheden
- SIM-beheer en netwerktoegang zijn gestandaardiseerd

### Teltonika RMS als remote management platform

Beslissing: Teltonika RMS wordt gebruikt voor remote management van routers en indirect van de Pi.

Afspraken:
- camera IP-detectie verloopt via RMS
- remote access als de Pi uitvalt verloopt via RMS
- Pi fungeert als brug naar het lokale netwerk voor RMS-commando's

### HTTP snapshots blijven de aanpak

Beslissing: camera snapshots blijven via HTTP ophalen, geen RTSP.

Reden: eenvoudiger, werkt met bestaande camera's, filtering op Pi is voldoende.

### Operations Center als aparte pagina

Beslissing: technisch beheer krijgt een eigen pagina `/operations`, los van `/admin`.

Afspraken:
- admin = klantbeheer (klanten, memberships, invites, provisioning)
- operations = technisch beheer (real-time boxstatus, netwerk, hardware, remote acties, kosten)
- de twee lagen worden niet gemengd in één scherm

## 2026-04-18 - Magic Link login toegevoegd

Beslissing: naast Google login wordt Magic Link (passwordless email) ondersteund als tweede loginmethode.

Reden: sommige gebruikers hebben geen Google-account of willen geen Google-koppeling.

Implementatie:
- `firebase.ts`: `magicLinkSettings` en `sendSignInLinkToEmail` toegevoegd
- `AuthPanel.tsx`: twee loginopties (Google knop + Magic Link formulier)
- `activate-invite/page.tsx`: beide opties beschikbaar in stap 1 van de wizard
- Firebase Console: Email/Password en Email link (passwordless) beide actief

Afspraak: beide methodes zijn gelijkwaardig. De backend controleert alleen of het Firebase-token geldig is en of het email-adres overeenkomt — de loginmethode zelf maakt niet uit.

## 2026-04-18 - PlatformAdmin bypass in portal

Beslissing: `requireCustomerContext` in `boxes.ts` slaat de `customerId`-check over voor gebruikers met `role === "platformAdmin"`.

Reden: platformAdmin heeft geen `customerId` in de membership, waardoor ze anders altijd "geen toegang" zagen in het portal.

Gevolg:
- platformAdmin ziet alle boxen in `/portal/boxes` zonder `customerBoxAccess` filter
- hardcoded email-fallback (`piet.dijkmans@gmail.com`) werkt ook als membership ontbreekt

## 2026-04-18 - Mobiele viewport en overflow fix

Beslissing: viewport meta tag en overflow-x hidden vastgelegd als standaard in `layout.tsx`.

Reden: zonder viewport meta tag rendert iOS Safari de pagina op desktop-breedte (~980px) en zoomt uit. Zonder `overflow-x: hidden` op `html` en `body` snapt de pagina terug naar de brede versie na scrollen op iPhone.

Implementatie:
- `layout.tsx`: `Viewport` export met `width: "device-width"` en `initialScale: 1`
- `layout.tsx`: `overflowX: "hidden"` op `<html>` en `<body>`
- Header: `px-4 lg:px-8` i.p.v. vaste `px-8`, logo `max-w` beperkt, titel `text-2xl lg:text-3xl`
- Artikel linkerkolom: `min-w-0` i.p.v. `min-w-[280px]`
