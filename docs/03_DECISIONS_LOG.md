# DECISIONS LOG

## API tussen frontend en Firestore
? gekozen voor security en controle

## Eén membership per email
? eenvoudig maar risico op overschrijven

## customer.active
? globale switch voor toegang

## customerBoxAccess apart
? flexibel en schaalbaar

## Doc ID = customerId__boxId
? voorkomt duplicaten

## Roles
- platformAdmin
- customerAdmin
- viewer

## Shares niet voor portal access
? andere use case
