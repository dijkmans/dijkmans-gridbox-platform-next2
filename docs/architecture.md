# Architectuur

## Huidige toestand
- De live website draait momenteel nog op legacy frontend-bestanden in de repo-root, met name index.html en 404.html.
- Firebase hosting verwijst momenteel naar de repo-root via firebase.json.
- Python scripts staan momenteel onder /src.
- Cloud Functions staan onder /cloud-functions.

## Nieuwe richting
- Nieuwe webarchitectuur komt onder /web.
- /web/src/app bevat routes en pagina-opbouw.
- /web/src/features bevat domeinlogica per onderwerp, zoals boxes, sessions, users.
- /web/src/lib bevat technische basis zoals Firebase-configuratie en helpers.
- /web/src/shared bevat gedeelde UI en vaste constanten.
- /web/src/legacy is bedoeld voor tijdelijke overname van oude frontendstukken tijdens migratie.

## Belangrijke regel
- We vervangen de huidige website gefaseerd.
- De publieke URL blijft dezelfde.
- De onderliggende code wordt stapsgewijs herbouwd.
