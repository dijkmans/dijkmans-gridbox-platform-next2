# Repo-structuur

## Root
- /cloud-functions = Firebase Cloud Functions
- /config = lokale of genegeerde configuratie
- /docs = projectdocumentatie
- /logs = logs
- /src = bestaande Python scripts en tooling
- /tests = testzone
- /web = nieuwe frontend-architectuur
- index.html = huidige legacy live frontend
- firebase.json = Firebase configuratie
- main.py = Python entrypoint of runtime-script

## Nieuwe frontendstructuur
- /web/src/app
- /web/src/features
- /web/src/lib
- /web/src/shared
- /web/src/legacy

## Afspraken
- Nieuwe frontendcode komt niet meer in de repo-root.
- Nieuwe frontendcode komt niet in /src.
- /src blijft voorlopig bestaan voor Python-gerelateerd werk.
- Legacy frontend blijft tijdelijk bestaan tot vervanging per onderdeel.
