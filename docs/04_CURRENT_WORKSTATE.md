# CURRENT WORKSTATE

## Status

- admin werkt
- dropdowns werken
- API is de centrale backend
- basisarchitectuur is vastgelegd

## Architectuur (vastgelegd)

- frontend = `/gridbox-portal`
- backend = `/gridbox-api`
- device laag = root `/src`
- `cloud-functions` = ondersteunend
- root `index.html` = legacy
- `/web` = onzeker of legacy en niet leidend

## Problemen

- memberships kunnen overschreven worden
- duplicate preventie ontbreekt of is onvoldoende
- delete en deactivate zijn nog niet voldoende uitgewerkt
- UI validatie moet sterker
- huidige membership structuur is te zwak als die alleen op e-mail steunt
- invite-flow ontbreekt nog
- gsm-verificatie ontbreekt nog
- onderscheid tussen invited user en actieve gebruiker ontbreekt nog

## Regels

- niet verder bouwen op de verkeerde frontend
- geen nieuwe features in `/web`
- geen nieuwe platformfunctionaliteit in root `index.html`
- frontend blijft via API werken
- architectuur eerst respecteren, dan uitbreiden

## Locatiemodel (vastgelegd)

- `sites` is de enige bron van waarheid voor locaties
- `boxes` verwijst via `siteId`
- legacy locatievelden op boxniveau zijn niet leidend

## Identity-richting (vastgelegd)

Vastgelegd:
- master maakt eerst een invite aan via e-mailadres
- invite is nog geen actieve gebruiker
- activatie gebeurt via unieke, tijdelijke invite-link
- gebruiker vult zelf gsm-nummer in
- gsm wordt geverifieerd via sms-code
- pas daarna wordt membership actief
- Firebase Auth doet authenticatie en phone verification
- backend en Firestore beheren invites, memberships, rollen en scope

## Huidige richting camera

Vastgelegd:
- filtering gebeurt op de Raspberry Pi
- snapshots worden genomen elke 5 seconden
- vergelijking gebeurt altijd met het laatst opgeslagen beeld
- `session start` = box open
- `session end` = box close
- startbeeld wordt altijd opgeslagen
- eindbeeld wordt altijd opgeslagen
- tussenbeelden worden alleen opgeslagen bij betekenisvolle wijziging
- alleen geselecteerde beelden gaan naar Google Cloud Storage
- Firestore bevat alleen metadata

Nog uit te werken:
1. exacte diff threshold
2. exacte cooldownwaarde
3. keuze hoe strikt ROI in v1 wordt toegepast
4. foutafhandeling bij uploadproblemen
5. definitieve Firestore-structuur voor sessies en captures
6. portal-tijdlijn per sessie

## Volgende stappen

1. platformAdmin beschermen
2. duplicates blokkeren
3. UI valideren
4. data model verder opschonen via `sites` en `boxes`
5. camera-architectuur implementeren in `listener.py`
6. legacy en twijfelzones uit de actieve lijn halen
7. invite-flow implementeren
8. gsm-verificatie via Firebase integreren
9. memberships koppelen aan `authUid` in plaats van alleen e-mail
10. onderscheid invoeren tussen invites en memberships

## Belangrijk inzicht

Als deze structuur niet gerespecteerd wordt, verlies je richting in code, data en documentatie.

Dus:
eerst structuur, dan features

## 2026-03-22 - Reproduceerbare werkende toestand listener en lokale testketen

### Bevestigde werkende toestand

Deze toestand is bevestigd als werkend op:

- Git branch: `rescue/full-backup-2026-03-21`
- Commit: `8f3eebf`
- Tag: `listener-working-2026-03-22`

### Wat vandaag effectief werkte

Lokaal:

- `gridbox-portal` draaide op `localhost:3000`
- `gridbox-api` draaide op `localhost:8080`

Belangrijk:
de portal werkt lokaal niet correct zonder dat ook de API draait op poort 8080.

Raspberry Pi:

- systemd service: `gridbox.service`
- runtime pad:
  - `/home/pi/dijkmans-gridbox-platform-next2/src/listener.py`

### Belangrijke dependency op de Raspberry Pi

Vereist op de Pi:

- `python3-pil`

Installatiecommando:
sudo apt update && sudo apt install -y python3-pil

Zonder deze package start `listener.py` niet op en faalt `gridbox.service` met:

- `ModuleNotFoundError: No module named 'PIL'`

### Listener toestand

De listener op de Pi is bijgewerkt met de versie van de lokale repository.

Voor de update was de file op de Pi inhoudelijk verschillend van de lokale file.
De nieuwe versie start correct op en verwerkt open en close commando's.

### Bevestigd gedrag snapshotlogica

Bevestigd werkend:

- bij `OPEN` start een snapshotsessie
- `open_start` wordt altijd opgeslagen
- tijdens `open` worden alleen relevante beelden opgeslagen
- bij `CLOSE` wordt `open_end` altijd opgeslagen
- post-close snapshotperiode blijft nog lopen volgens `postCloseSnapshotDurationSeconds`
- tijdens `post-close` worden beelden alleen opgeslagen bij voldoende wijziging of wanneer de logica dit toelaat
- sessie wordt correct beëindigd na de post-close periode

### Praktische testketen

Werkende testketen:

- portal -> API -> Firestore -> listener -> I2C

### Operationele notities

Voor lokale tests moeten meestal 3 vensters actief zijn:

1. portal
2. API
3. SSH naar de Pi met live logs

Typische commando's:

Portal:
cd gridbox-portal
npm run dev

API:
cd gridbox-api
npm run dev

Pi logs:
sudo journalctl -u gridbox.service -f

### Aandachtspunt

De snapshotfiltering is nu strenger dan in de oudere Pi-versie.
Dat is bewust voorlopig aanvaard.
Praktijkobservatie moet later uitwijzen of threshold en cooldown verder bijgestuurd moeten worden.
