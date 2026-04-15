# INVITE PROCEDURE AND ACTIVATION FLOW

## Doel

Een master kan een nieuwe gebruiker uitnodigen zonder die gebruiker onmiddellijk actieve toegang te geven.

Belangrijk onderscheid:

1. invited user
- uitgenodigd via e-mailadres
- nog geen actieve gebruiker
- nog geen toegang

2. authenticated user
- bestaat in Firebase Authentication
- identiteit via login
- e-mail en gsm kunnen geverifieerd worden

3. active membership
- gebruiker heeft effectieve rechten in het Gridbox platform
- gekoppeld aan customer, role, scope en authUid
- pas actief na volledige activatie

## Hoofdregels

- een invite is nog geen membership
- een Firebase user is niet automatisch gemachtigd
- invite-link is uniek, tijdelijk geldig en éénmalig bruikbaar
- alleen de hash van de token wordt opgeslagen
- e-mailadres van de ingelogde gebruiker moet overeenkomen met de invite
- gsm-verificatie via Firebase Authentication is verplicht
- membership wordt pas aangemaakt of geactiveerd na succesvolle verificatie
- autorisatie gebeurt op basis van membership gekoppeld aan authUid
- frontend werkt altijd via de API
- frontend beslist nooit zelf of een invite geldig of opgebruikt is

## Collections

### invites

Voorstel velden:

- id
- email
- displayName
- customerId
- role
- scope
- createdByAuthUid
- tokenHash
- expiresAt
- status
- createdAt
- acceptedAt
- acceptedByAuthUid
- phoneNumber
- phoneVerified

Toegelaten statuswaarden:

- pending
- accepted
- expired
- revoked

### memberships

Voorstel velden:

- id
- authUid
- email
- displayName
- phoneNumber
- phoneVerified
- customerId
- role
- scope
- active
- invitedByAuthUid
- inviteId
- createdAt
- activatedAt

Belangrijk:

- membership mag niet alleen op e-mail steunen
- authUid is de technische koppeling naar Firebase Authentication
- active mag pas true worden na volledige activatie

## Rollen

Voorlopige rollen:

- platformAdmin
- customerAdmin
- viewer

Opmerking:
platformAdmin mag niet zomaar via een gewone customer invite worden toegekend zonder bijkomende controle.
Daar moet de backend expliciet streng op zijn.

## Invite-flow

### Stap 1 - master maakt invite aan

Input:

- email
- displayName optioneel
- customerId
- role
- scope

Backend doet:

- validatie van rol en scope
- check op ongewenste duplicaten
- genereren van unieke raw token
- opslaan van tokenHash in Firestore
- status = pending
- expiresAt invullen
- invite-mail voorbereiden of versturen

Belangrijk:
hier wordt nog geen actieve membership aangemaakt.

### Stap 2 - gebruiker ontvangt invite-link

De invite-link:

- is uniek
- is tijdelijk geldig
- is éénmalig bruikbaar

Voorbeeld:

/activate-invite?token=...

Belangrijk:
de frontend gebruikt de token alleen om via de API te laten controleren of de invite geldig is.

### Stap 3 - invite valideren

Frontend roept API aan met de raw token.

Backend controleert:

- invite bestaat
- tokenHash komt overeen
- status is pending
- invite is niet expired
- invite is niet revoked
- invite is nog niet accepted

Pas daarna mag de activatieflow verder.

### Stap 4 - gebruiker logt in via Firebase Authentication

Gebruiker:

- logt in
of
- maakt een account aan

Backend controleert daarna:

- er is een geldige authenticated user
- e-mailadres van Firebase user komt overeen met invite email

Zonder e-mailmatch mag activatie niet doorgaan.

### Stap 5 - gebruiker vult gsm-nummer in

Gebruiker vult zijn gsm-nummer zelf in.

Daarna volgt verificatie via sms-code in Firebase Authentication.

Belangrijk:
de backend mag niet vertrouwen op een los formulier zonder geldige auth-context.

### Stap 6 - phone verification

Na succesvolle sms-verificatie geldt:

- phoneNumber is gekend
- phoneVerified = true

Pas nu is de identiteit sterk genoeg om een membership te activeren.

### Stap 7 - membership activeren

Backend doet nu pas:

- membership aanmaken of definitief activeren
- koppelen aan authUid
- email opslaan
- phoneNumber opslaan
- phoneVerified = true
- active = true
- activatedAt invullen
- inviteId koppelen
- invitedByAuthUid bewaren

Daarna wordt de invite aangepast naar:

- status = accepted
- acceptedAt invullen
- acceptedByAuthUid invullen

## API-contracten

### POST /admin/invites

Doel:
master of admin maakt een invite aan.

Input:

- email
- displayName
- customerId
- role
- scope

Output:

- inviteId
- status

### POST /invites/validate

Doel:
controleren of een invite-link nog geldig is.

Input:

- token

Output bij succes:

- valid = true
- email
- displayName
- customerId
- role
- scope
- expiresAt

### POST /invites/accept

Doel:
definitieve activatie van de invite.

Input:

- token
- displayName optioneel
- phoneNumber

Belangrijk:
authUid en email komen uit de Firebase-authenticated user, niet uit de request body.

Backend checks:

- invite geldig
- invite pending
- token correct
- niet expired
- niet revoked
- Firebase user aanwezig
- email match
- phone verified
- geen conflict met bestaande actieve membership

Output:

- success = true
- membershipId

## Foutcodes

### Invite
- INVITE_NOT_FOUND
- INVITE_INVALID
- INVITE_EXPIRED
- INVITE_REVOKED
- INVITE_ALREADY_USED

### Auth
- AUTH_REQUIRED
- EMAIL_MISMATCH
- PHONE_NOT_VERIFIED

### Membership
- MEMBERSHIP_ALREADY_EXISTS
- MEMBERSHIP_CONFLICT

### Permissions
- FORBIDDEN_CREATE_INVITE

## Duplicate-regels

Voorstel v1:

- maximaal één actieve pending invite per combinatie van customerId en email
- een tweede invite voor dezelfde context moet de vorige pending invite blokkeren of revoken
- een accepted invite kan niet opnieuw gebruikt worden
- een bestaande actieve membership voor exact dezelfde context moet nieuwe activatie blokkeren of expliciet laten herbekijken

## Security-principes

- raw token nooit in Firestore bewaren
- alleen tokenHash bewaren
- invite-links moeten vervallen
- frontend krijgt geen rechtstreekse Firestore-logica
- autorisatie gebeurt in de API
- toegang tot portal alleen op basis van actieve membership

## Niet toegelaten

- membership automatisch aanmaken bij invite
- toegang geven puur op basis van e-mail
- invite-link laten volstaan zonder login
- phoneVerified manueel op true zetten zonder echte verificatie
- frontend rechtstreeks met Firestore laten werken voor invite-logica

## Open implementatiepunten

Nog technisch uit te werken:

1. exacte expiry-duur van een invite
2. precieze duplicate-strategie bij opnieuw uitnodigen
3. audit logging per stap
4. mailtemplate voor invite
5. UI-schermen voor activatie
6. middleware voor portal access op basis van active membership
7. migratiepad van email-only memberships naar authUid-based memberships

## Besluit

De invite-procedure is de verplichte nieuwe standaard.

Volgorde:

1. invite aanmaken
2. invite valideren
3. login via Firebase
4. gsm-verificatie
5. membership activeren
6. toegang geven

Dus:

invite eerst
membership pas op het einde
