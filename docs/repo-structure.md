# Repo-structuur

## Root

- `/archive` — oude backups, dumps en inactieve bestanden
- `/cloud-functions` — Firebase Cloud Functions (ondersteunend, niet leidend)
- `/docs` — projectdocumentatie
- `/gridbox-api` — actieve backend (Node.js / Express)
- `/gridbox-portal` — actieve frontend (Next.js)
- `/src` — device laag (Python, Raspberry Pi)
- `firebase.json` — Firebase configuratie (Hosting + Functions)
- `index.html` — legacy frontend (niet meer leidend)
- `404.html` — legacy
- `START_HIER.ps1` — SD-kaart provisioning script

## /gridbox-api — Backend

Draait op Google Cloud Run (`europe-west1`).

```
/gridbox-api
  /src
    /auth
      verifyBearerToken.ts       — Firebase ID token verificatie
    /config
      env.ts                     — omgevingsvariabelen
      firebase.ts                — Firebase Admin initialisatie
    /repositories
      boxRepository.ts
      commandRepository.ts
      customerBoxAccessRepository.ts
      customerRepository.ts
      membershipRepository.ts    — getMembershipByEmail (lookup op email)
      platformConfigRepository.ts
      siteRepository.ts
    /routes
      admin.ts                   — /admin/* endpoints (requirePlatformAdmin)
      boxes.ts                   — /portal/* endpoints (requireCustomerContext)
      device.ts                  — /device/* endpoints (geen auth, Pi-side)
      invites.ts                 — /invites/validate, /invites/accept
      operations.ts              — /operations/* endpoints
    /services
      birdSms.ts                 — SMS verzenden via Bird API
    /mappers
      boxDetailMapper.ts
      boxMapper.ts
    server.ts
    app.ts
  Dockerfile
  package.json
  tsconfig.json
```

Startcommando's:
- dev: `npm run dev` (ts-node-dev, hot reload)
- productie: `npm run build && node dist/server.js`
- deploy: `gcloud run deploy gridbox-api --region europe-west1 --source .`

## /gridbox-portal — Frontend

Gedeployed op Firebase Hosting (`https://gridbox-platform.web.app`).
Geconfigureerd als static export (`output: export`).

```
/gridbox-portal
  /src
    /app
      layout.tsx                 — root layout, viewport meta, overflow-x hidden
      page.tsx                   — portal homepagina (boxoverzicht)
      /admin
        page.tsx                 — admin dashboard
        /box/[id]
          page.tsx
          AdminBoxConfigClient.tsx  — box configuratie incl. camera onboarding
      /activate-invite
        page.tsx                 — invite activatie wizard (Google + Magic Link)
      /operations
        page.tsx
      /portal
        /box
          page.tsx
        /box-events
          page.tsx
        /box-picture
          page.tsx
    /components
      SmartToggleButton.tsx
      /admin
        AdminProvisioningSection.tsx
        adminApi.ts
        types.ts
    /lib
      api.ts                     — apiUrl() helper
      firebase.ts                — Firebase Auth init, googleProvider, magicLinkSettings
      design-tokens.ts           — importeerbare design constanten
  globals.css
  package.json
  next.config.ts                 — output: export
```

Startcommando's:
- dev: `npm run dev`
- build + deploy: `npm run build && firebase deploy --only hosting`

## /src — Device laag (Raspberry Pi)

```
/src
  listener.py          — hoofdscript op de Pi (main loop, commando verwerking, heartbeat)
  listener_pi.py       — Pi-specifieke uitvoering en bootstrap logica
  camera_manager.py    — snapshot capture, change detection, GCS upload
  db_manager.py        — Firestore lees/schrijf operaties
  ...
```

Op de Pi gestart via `gridbox.service` (systemd).

Camera flow in `camera_manager.py`:
- `take_snapshot()` — JPEG ophalen via HTTP (snapshotUrl + optioneel BasicAuth)
- `analyze_snapshot_change()` — grijswaarden verschilscore berekenen
- `should_store_snapshot()` — beslissing op basis van phase, threshold, cooldown
- Upload naar GCS: `snapshots/{boxId}/{filename}`
- Metadata naar Firestore: `boxes/{boxId}/snapshots`

## /cloud-functions — Ondersteunend

Firebase Cloud Functions. Niet leidend voor business logic — dat loopt via `/gridbox-api`.

## Afspraken

- Nieuwe frontendcode komt uitsluitend in `/gridbox-portal`.
- Nieuwe backendcode komt uitsluitend in `/gridbox-api`.
- Device code blijft in `/src`.
- root `index.html` is legacy — niet meer aanpassen.
- `/web` bestaat niet meer als actieve directory.
- Frontend praat nooit rechtstreeks met Firestore — altijd via API.
