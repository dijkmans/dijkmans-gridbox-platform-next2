# CLAUDE.md

## Project
Repo: `dijkmans-gridbox-platform-next2`

Doel:
Werk het Gridbox-platform verder af, met huidige focus op `/admin` richting een echte provisioning- en installatiecockpit.

## Harde architectuurregels
- Volg altijd: `Frontend -> API -> Firestore`
- Geen frontend die centrale businesslogica rechtstreeks in Firestore schrijft
- Geen fake frontendstatus
- Geen lokale UI-trucs die backendstatus overschrijven
- Geen schijnzekerheid in de UI
- Backend en device zijn leidend voor status en autorisatie

## Huidige hoofdcontext
- Actieve frontend: `gridbox-portal`
- Actieve backend: `gridbox-api`
- Device runtime: `src/listener.py`
- Admin moet verder ontwikkeld worden richting `https://gridbox-platform.web.app/admin`
- Focus ligt nu op echte provisioningflow in admin

## Provisioningregels
- Provisioningstatussen:
  - `draft`
  - `awaiting_sd_preparation`
  - `awaiting_first_boot`
  - `claimed`
  - `online`
  - `ready`
  - `failed`
- UI mag `claimed` pas tonen na echte device claim
- UI mag `online` pas tonen na echte heartbeat of backendbevestiging
- UI mag `ready` pas tonen als backend/device dit inhoudelijk bevestigen
- Geen fake `online`, fake `ready`, fake `claimed`
- `sites` blijft de enige bron van waarheid voor locatie
- Geen losse locatievelden op boxniveau als alternatief voor `siteId`

## Adminregels
- `/admin` is alleen voor `platformAdmin`
- Adminstructuur altijd respecteren:
  1. overzicht
  2. installatiecockpit
  3. klassiek beheer
- Installatie is een flow
- Beheer is een overzicht
- Niet mengen in één rommelig scherm
- Gebruik eenvoudige UI-terminologie waar mogelijk:
  - `Memberships` -> `Gebruikerstoegang`
  - `Provisioning` -> `Installatievoorbereiding`
  - `Bootstrapbestanden` -> `Opstartbestanden`

## Werkwijze
- Werk via PowerShell
- Eén bestand tegelijk aanpassen
- Eerst lezen
- Dan kleine wijziging
- Dan build
- Dan `git diff`
- Geen grote scriptpatches
- Geen massale refactors zonder noodzaak
- Geen Notepad-flow
- Geen aannames op basis van oude handover of oude screenshots
- Lees eerst de actuele file-inhoud voor je iets wijzigt

## Verplichte workflow bij codewijzigingen
1. Lees eerst de relevante actuele bestanden volledig
2. Vat kort samen wat al bestaat
3. Benoem exact wat ontbreekt
4. Stel de eerstvolgende kleine veilige wijziging voor
5. Pas slechts die ene wijziging toe
6. Run build of typecheck indien relevant
7. Toon daarna de relevante `git diff`
8. Stop dan en wacht op volgende instructie

## Huidige frontendfocus
Lees bij admin provisioning eerst deze bestanden:
- `gridbox-portal/src/app/admin/page.tsx`
- `gridbox-portal/src/components/admin/sections/AdminProvisioningSection.tsx`
- `gridbox-portal/src/components/admin/types.ts`
- `gridbox-portal/src/components/admin/adminApi.ts`

Let daar expliciet op:
- `provisioningItem`
- `provisioningLookupId`
- `provisioningBusy`
- create handlers
- refresh handlers
- finalize handlers

## Wat nog kritisch open kan staan
- `page.tsx` provisioning state en flows exact in kaart brengen
- create / refresh / finalize logisch verbinden
- `AdminProvisioningSection.tsx` moet echte backendstatus tonen
- knop `Installatie afronden` alleen actief maken bij status `online`
- bootstrap-download en SD-prepared correct aan frontend koppelen
- `ready` correct tonen pas na echte finalize

## Regels voor antwoorden
- Wees kritisch
- Neem geen oude aannames klakkeloos over
- Zeg duidelijk wanneer iets onzeker is
- Leg eerst uit wat je gaat wijzigen en waarom
- Doe geen extra wijzigingen buiten scope
- Als een stap riskant is, kies de kleinere veilige stap

## Regels voor UI-uitwerking
- Geen schermen met alles door elkaar
- Wizard = één stap tegelijk
- Maximaal één duidelijke primaire actie per blok
- Geen technische ruis tonen als dat functioneel niet nodig is
- Geen backendtermen blind in de UI gooien zonder context
- Gebruik backend-gedragen statussen, niet zelf verzonnen tussentoestanden

## Regels voor autorisatie
- Rechten niet afleiden uit alleen frontendstate
- Rechten niet afleiden uit alleen Firestorelabels
- Geen e-mail allowlists als structurele autorisatie
- Backend/API blijft leidend

## Als je een taak krijgt rond admin provisioning
Doe dan standaard eerst dit:
- lees de 4 actuele frontendbestanden
- vat samen:
  1. wat al gebouwd is
  2. wat nog openstaat
  3. wat de eerstvolgende veilige wijziging is
- wijzig nog niets vóór die samenvatting

## Belangrijke houding
Sneller vooruitgaan is goed.
Slordig sneller gaan is fout.
Kies altijd de kleinste veilige stap die echte vooruitgang geeft.
