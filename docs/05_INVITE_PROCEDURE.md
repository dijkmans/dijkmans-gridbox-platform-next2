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
- identiteit via login (Google of Magic Link)
- e-mail en gsm kunnen geverifieerd worden

3. active membership
- gebruiker heeft effectieve rechten in het Gridbox platform
- gekoppeld aan customer, role en authUid
- pas actief na volledige activatie

## Hoofdregels

- een invite is nog geen membership
- een Firebase user is niet automatisch gemachtigd
- invite-link is uniek, tijdelijk geldig en éénmalig bruikbaar
- alleen de hash van de token wordt opgeslagen
- e-mailadres van de ingelogde gebruiker moet overeenkomen met de invite
- gsm-verificatie via Bird SMS API is verplicht
- membership wordt pas aangemaakt of geactiveerd na succesvolle verificatie
- autorisatie gebeurt op basis van membership opgezocht via email
- frontend werkt altijd via de API
- frontend beslist nooit zelf of een invite geldig of opgebruikt is

## Collections

### invites

Velden:

- id
- email
- displayName
- customerId
- role
- tokenHash
- expiresAt
- status (`pending` / `accepted` / `expired` / `revoked`)
- createdByAuthUid
- createdAt
- acceptedAt
- acceptedByAuthUid
- phoneNumber
- phoneVerified
- phoneVerification (object):
  - status
  - codeHash (SHA-256 hash van de SMS-code)
  - expiresAt
  - attemptCount
  - lastSentAt

### memberships

Velden:

- id
- authUid
- email
- displayName
- phoneNumber
- phoneVerified
- customerId
- role
- active
- invitedByAuthUid
- inviteId
- createdAt
- activatedAt
- updatedAt

Belangrijk:

- membership lookup in de API verloopt via email (`getMembershipByEmail`)
- authUid is de technische koppeling naar Firebase Authentication
- active mag pas true worden na volledige activatie
- platformAdmin heeft geen customerId nodig

## Rollen

Actuele rollen:

- platformAdmin
- customerAdmin
- customerOperator
- customerOperatorNoCamera
- customerViewer

platformAdmin mag niet via een gewone customer invite worden toegekend zonder bijkomende controle.
De backend is hier expliciet streng op.

## Invite-flow

### Stap 1 - master maakt invite aan

Input:

- email
- displayName optioneel
- customerId
- role

Backend doet:

- validatie van rol
- check op ongewenste duplicaten
- genereren van unieke raw token
- opslaan van tokenHash (SHA-256) in Firestore
- status = pending
- expiresAt invullen
- invite-link beschikbaar maken voor kopiëren

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

Twee methodes worden ondersteund, beide beschikbaar in de wizard:

- **Google login** — `signInWithPopup` met Google provider
- **Magic Link** — `sendSignInLinkToEmail` (passwordless email, `handleCodeInApp: true`)

Backend controleert daarna:

- er is een geldige authenticated user
- e-mailadres van Firebase user komt overeen met invite email

Zonder e-mailmatch mag activatie niet doorgaan.

### Stap 5 - gebruiker vult gsm-nummer in

Gebruiker vult zijn gsm-nummer zelf in.

Daarna volgt SMS-verificatie via Bird API:
- backend genereert een code
- slaat `codeHash` op in `invite.phoneVerification`
- verstuurt SMS via Bird (`BIRD_API_KEY`, `BIRD_WORKSPACE_ID`, `BIRD_CHANNEL_ID`, `BIRD_SMS_FROM`)
- gebruiker vult de ontvangen code in
- backend vergelijkt hash

Belangrijk:
de backend mag niet vertrouwen op een los formulier zonder geldige auth-context.

### Stap 6 - phone verification

Na succesvolle SMS-verificatie geldt:

- phoneNumber is gekend
- phoneVerified = true
- `invite.phoneVerification.status` = verified

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
admin maakt een invite aan.

Input:

- email
- displayName
- customerId
- role

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

- maximaal één actieve pending invite per combinatie van customerId en email
- een tweede invite voor dezelfde context moet de vorige pending invite blokkeren of revoken
- een accepted invite kan niet opnieuw gebruikt worden
- een bestaande actieve membership voor exact dezelfde context moet nieuwe activatie blokkeren

## Security-principes

- raw token nooit in Firestore bewaren
- alleen tokenHash (SHA-256) bewaren
- invite-links moeten vervallen
- frontend krijgt geen rechtstreekse Firestore-logica
- autorisatie gebeurt in de API
- toegang tot portal alleen op basis van actieve membership

## Niet toegelaten

- membership automatisch aanmaken bij invite
- toegang geven puur op basis van e-mail
- invite-link laten volstaan zonder login
- phoneVerified manueel op true zetten zonder echte Bird SMS verificatie
- frontend rechtstreeks met Firestore laten werken voor invite-logica

## Open implementatiepunten

1. exacte expiry-duur van een invite (nog te configureren)
2. precieze duplicate-strategie bij opnieuw uitnodigen
3. audit logging per stap
4. mailtemplate voor invite (invites worden nu handmatig gedeeld via link-kopieer knop)
5. ~~**UI-schermen voor activatie**~~ — afgewerkt: `activate-invite/page.tsx` wizard volledig gebouwd
6. ~~**middleware voor portal access op basis van active membership**~~ — afgewerkt: `requireCustomerContext` en `requirePlatformAdmin` in API
7. migratiepad van email-only memberships naar authUid-based memberships

## Besluit

De invite-procedure is de verplichte nieuwe standaard.

Volgorde:

1. invite aanmaken
2. invite valideren
3. login via Firebase (Google of Magic Link)
4. gsm-verificatie via Bird SMS
5. membership activeren
6. toegang geven

Dus:

invite eerst
membership pas op het einde
