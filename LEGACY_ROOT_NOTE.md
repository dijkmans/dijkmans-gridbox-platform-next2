# LEGACY ROOT NOTE

## Status van de repo-root

De repo-root bevat nog enkele legacy bestanden die tijdelijk behouden blijven om bestaande hosting of overgangsscenario's te ondersteunen.

Belangrijk:
- nieuwe platformontwikkeling gebeurt NIET in de repo-root
- de officiële frontend staat in `/gridbox-portal`
- de officiële backend staat in `/gridbox-api`
- de officiële device-laag staat in `/src`

## Legacy bestanden in root

Deze bestanden moeten als legacy beschouwd worden:
- `index.html`
- `404.html`

Ze blijven voorlopig bestaan zolang de legacy hosting nog niet volledig vervangen is.

## Regels

- geen nieuwe features toevoegen in root `index.html`
- geen nieuwe platformlogica toevoegen in root
- root dient alleen nog als tijdelijke legacy-zone

## Officiële richting

- frontend = `/gridbox-portal`
- backend = `/gridbox-api`
- device runtime = `/src`
- `cloud-functions` = ondersteunend
- `archive/` bevat oude of niet-leidende onderdelen
