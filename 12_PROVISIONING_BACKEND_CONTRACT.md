\# 12\_PROVISIONING\_BACKEND\_CONTRACT



\## Doel



Dit document legt het minimale backendcontract vast voor echte provisioning van een nieuwe Gridbox.

De admin-cockpit mag niets als "klaar", "online" of "geclaimd" tonen zolang backend of device dat niet echt bevestigd heeft.



\## Richting



De flow is:



1\. Admin maakt provisioningrecord aan

2\. Admin downloadt beperkte bootstrapinfo

3\. Bootstrapinfo gaat op SD-kaart

4\. Device start voor het eerst op

5\. Device claimt zichzelf

6\. Device stuurt heartbeat

7\. Backend bevestigt status

8\. UI mag pas daarna echte live-status tonen



\## Nieuwe collectie



Collection: `provisionings`



\## ProvisioningStatus



```ts

type ProvisioningStatus =

&#x20; | "draft"

&#x20; | "awaiting\_sd\_preparation"

&#x20; | "awaiting\_first\_boot"

&#x20; | "claimed"

&#x20; | "online"

&#x20; | "ready"

&#x20; | "failed";



type ProvisioningRecord = {

&#x20; id: string;

&#x20; boxId: string;

&#x20; customerId: string;

&#x20; siteId: string;

&#x20; status: ProvisioningStatus;

&#x20; bootstrapTokenHash: string;

&#x20; createdAt: string;

&#x20; createdBy: string;

&#x20; claimedAt?: string;

&#x20; claimedByDevice?: string;

&#x20; lastHeartbeatAt?: string;

&#x20; lastError?: string;

&#x20; profileId?: string;

&#x20; notes?: string;

};



type CreateProvisioningRequest = {

&#x20; boxId: string;

&#x20; customerId: string;

&#x20; siteId: string;

&#x20; profileId?: string;

&#x20; notes?: string;

};





type BootstrapDownloadResponse = {

&#x20; provisioningId: string;

&#x20; boxId: string;

&#x20; bootstrapToken: string;

&#x20; apiBaseUrl: string;

&#x20; bootstrapVersion: string;

};








## Addendum 2026-04-02 - actuele stand

Reeds geïmplementeerd in `gridbox-api/src/routes/admin.ts`:

- POST `/admin/provisioning/boxes`
- GET `/admin/provisioning/:id`

Belangrijke nuance:

- de create-route slaat vandaag al een `bootstrapTokenHash` op
- de response geeft `bootstrapTokenHash` niet terug aan de frontend
- bij de volgende stap moet bewust gekozen worden tussen:
  - bootstrapToken pas genereren in de bootstrap-downloadroute
  - of bootstrapToken daar expliciet roteren en de hash overschrijven

## Volgende implementatiestap

Volgende echte backendstap:

- POST `/admin/provisioning/:id/bootstrap-download`

Doel:

- beperkte bootstrapinfo teruggeven voor op de SD-kaart
- geen brede secrets teruggeven
- admin alleen backend-bevestigde info laten tonen
