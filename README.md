# dijkmans-gridbox-platform-next2

## Doel van deze repository
Deze repository bevat momenteel meerdere delen van het Gridbox-platform:
- legacy websitebestanden in de repo-root
- Python scripts en tooling onder /src
- Firebase Cloud Functions onder /cloud-functions
- projectdocumentatie onder /docs
- nieuwe frontend-architectuur onder /web

## Huidige situatie
- De publieke website draait momenteel nog op de legacy frontend in de repo-root, met name index.html en 404.html.
- Firebase Hosting verwijst momenteel nog naar de repo-root via firebase.json.
- De nieuwe frontendstructuur wordt voorbereid onder /web.
- De huidige migratie gebeurt gefaseerd. De publieke URL blijft dezelfde.

## Belangrijke mappen
- /cloud-functions = Firebase Cloud Functions
- /config = lokale of genegeerde configuratie
- /docs = projectdocumentatie
- /logs = logs
- /src = bestaande Python scripts en tooling
- /tests = testzone
- /web = nieuwe frontend-architectuur

## Nieuwe frontendstructuur
- /web/src/app = routes en pagina-opbouw
- /web/src/features = domeinlogica per onderwerp
- /web/src/lib = technische basis en helpers
- /web/src/shared = gedeelde onderdelen
- /web/src/legacy = tijdelijke opvang van oude frontendstukken tijdens migratie

## Branchstrategie
- main = stabiele hoofdlijn
- staging = integratietak voor gecontroleerde samenvoeging
- feature/* = afgebakende wijzigingen
- wip/* = tijdelijke werkbranches voor tussenstappen

## Werkafspraken
- Nieuwe frontendcode komt niet meer in de repo-root.
- Nieuwe frontendcode komt niet in /src.
- /src blijft voorlopig bestaan voor Python-gerelateerd werk.
- Legacy frontend blijft tijdelijk bestaan tot vervanging per onderdeel.
- Gevoelige bestanden zoals service-account.json horen niet in Git-tracking thuis.
- Grote wijzigingen gebeuren via feature branches en worden eerst naar staging gebracht.

## Documentatie
Zie ook:
- /docs/architecture.md
- /docs/repo-structure.md
- /docs/migration-log.md

## Huidige migratierichting
1. Repo structureren
2. Documentatie op orde brengen
3. Nieuwe frontend onder /web opbouwen
4. Legacy frontend gefaseerd vervangen
5. Uiteindelijk dezelfde publieke URL behouden met nieuwe onderliggende structuur