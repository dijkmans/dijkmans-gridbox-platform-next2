"use client";

import { getBoxLabel } from "../helpers";
import type { SiteSummary } from "../derived";
import type { AdminBoxItem, CustomerItem, ProvisioningStepContent } from "../types";

type AdminProvisioningSectionProps = {
  selectedProvisioningStep: number;
  provisioningSteps: string[];
  provisioningStepContent: ProvisioningStepContent[];
  customers: CustomerItem[];
  siteSummaries: SiteSummary[];
  boxes: AdminBoxItem[];
  provisioningCustomerId: string;
  provisioningSiteId: string;
  provisioningBoxId: string;
  onProvisioningCustomerChange: (value: string) => void;
  onProvisioningSiteChange: (value: string) => void;
  onProvisioningBoxIdChange: (value: string) => void;
  onStepChange: (step: number) => void;
};

export default function AdminProvisioningSection({
  selectedProvisioningStep,
  provisioningSteps,
  provisioningStepContent,
  customers,
  siteSummaries,
  boxes,
  provisioningCustomerId,
  provisioningSiteId,
  provisioningBoxId,
  onProvisioningCustomerChange,
  onProvisioningSiteChange,
  onProvisioningBoxIdChange,
  onStepChange
}: AdminProvisioningSectionProps) {
  const sortedCustomers = [...customers].sort((a, b) =>
    (a.name || a.id).localeCompare(b.name || b.id)
  );

  const sortedSites = [...siteSummaries].sort((a, b) => a.siteId.localeCompare(b.siteId));

  const selectedCustomer = customers.find((customer) => customer.id === provisioningCustomerId);
  const trimmedSiteId = provisioningSiteId.trim();
  const trimmedBoxId = provisioningBoxId.trim();
  const normalizedBoxId = trimmedBoxId.toLowerCase();

  const existingBoxIds = new Set(
    boxes.map((box) => (box.boxId || box.id).trim().toLowerCase()).filter(Boolean)
  );

  const existingSite = sortedSites.find((site) => site.siteId === trimmedSiteId);

  const boxIdLooksValid = trimmedBoxId.length > 0 && /^[a-z0-9-]+$/.test(trimmedBoxId);
  const boxIdAlreadyExists = trimmedBoxId.length > 0 && existingBoxIds.has(normalizedBoxId);

  const customerChosen = provisioningCustomerId.trim().length > 0;
  const siteChosen = trimmedSiteId.length > 0;
  const boxChosen = trimmedBoxId.length > 0;

  const stepOneReady =
    customerChosen &&
    siteChosen &&
    boxChosen &&
    boxIdLooksValid &&
    !boxIdAlreadyExists;

  const customerLabel = selectedCustomer?.name || provisioningCustomerId || "-";

  const conceptProvisioningDraft = {
    customerId: provisioningCustomerId || null,
    siteId: trimmedSiteId || null,
    boxId: normalizedBoxId || null,
    siteMode: existingSite ? "existing" : trimmedSiteId ? "new" : null,
    status: "draft",
    source: "admin-cockpit",
    nextStep: "sd-card-prep"
  };

  const conceptProvisioningDraftJson = JSON.stringify(conceptProvisioningDraft, null, 2);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Installatiecockpit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            We bouwen deze cockpit stap voor stap uit. Alleen echte voorbereiding,
            geen fake provisioningstatus en geen verzonnen succes.
          </p>
        </div>
        <div className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Alleen voor platformbeheer
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        Let op: deze cockpit maakt in deze fase nog geen backend-record aan. Dit is
        voorbereiding, validatie en duidelijke invoer voor de latere provisioningflow.
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {provisioningSteps.map((step, index) => {
            const active = selectedProvisioningStep === index;

            return (
              <button
                key={step}
                type="button"
                onClick={() => onStepChange(index)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Stap {index + 1}
                </div>
                <div className="mt-2 text-sm font-bold">{step}</div>
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          {selectedProvisioningStep === 0 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Nieuwe box voorbereiden</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Hier leg je de basis vast. Eerst klant, site en box-ID juist kiezen.
                  Pas daarna heeft verdere provisioning zin.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Klant
                  </label>
                  <select
                    value={provisioningCustomerId}
                    onChange={(e) => onProvisioningCustomerChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  >
                    <option value="">-- Kies een klant --</option>
                    {sortedCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name || customer.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    De box hoort meteen aan een klantcontext gekoppeld te zijn.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Site
                  </label>
                  <input
                    list="provisioning-site-suggestions"
                    value={provisioningSiteId}
                    onChange={(e) => onProvisioningSiteChange(e.target.value)}
                    placeholder="bv. geel-hoofdsite"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                  <datalist id="provisioning-site-suggestions">
                    {sortedSites.map((site) => (
                      <option key={site.siteId} value={site.siteId} />
                    ))}
                  </datalist>
                  <p className="mt-2 text-xs text-slate-500">
                    Je mag een bestaande site kiezen of al een nieuwe site-ID voorbereiden.
                  </p>
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nieuwe box-ID
                  </label>
                  <input
                    value={provisioningBoxId}
                    onChange={(e) => onProvisioningBoxIdChange(e.target.value)}
                    placeholder="bv. gbox-007"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                  <div className="mt-2 space-y-1 text-xs">
                    {!boxChosen && (
                      <p className="text-slate-500">
                        Gebruik kleine letters, cijfers en koppeltekens.
                      </p>
                    )}
                    {boxChosen && !boxIdLooksValid && (
                      <p className="text-red-600">
                        Ongeldig formaat. Gebruik alleen kleine letters, cijfers en koppeltekens.
                      </p>
                    )}
                    {boxChosen && boxIdLooksValid && boxIdAlreadyExists && (
                      <p className="text-red-600">
                        Deze box-ID bestaat al. Kies een nieuwe unieke box-ID.
                      </p>
                    )}
                    {boxChosen &&
                      boxIdLooksValid &&
                      !boxIdAlreadyExists &&
                      trimmedBoxId !== normalizedBoxId && (
                        <p className="text-amber-700">
                          Let op: gebruik liever meteen kleine letters. Voorstel: {normalizedBoxId}
                        </p>
                      )}
                    {boxChosen &&
                      boxIdLooksValid &&
                      !boxIdAlreadyExists &&
                      trimmedBoxId === normalizedBoxId && (
                        <p className="text-green-700">
                          Box-ID-formaat ziet er goed uit.
                        </p>
                      )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-900">
                    Samenvatting van stap 1
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="text-slate-500">Klant</span>
                      <span className="font-semibold text-slate-900">{customerLabel}</span>
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="text-slate-500">Site</span>
                      <span className="font-semibold text-slate-900">
                        {trimmedSiteId || "-"}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="text-slate-500">Nieuwe box-ID</span>
                      <span className="font-semibold text-slate-900">
                        {trimmedBoxId || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-900">Controle</div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div
                      className={`rounded-xl px-4 py-3 ${
                        customerChosen ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {customerChosen ? "Klant gekozen" : "Nog geen klant gekozen"}
                    </div>

                    <div
                      className={`rounded-xl px-4 py-3 ${
                        siteChosen ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {siteChosen ? "Site ingevuld" : "Nog geen site ingevuld"}
                    </div>

                    <div
                      className={`rounded-xl px-4 py-3 ${
                        boxChosen && boxIdLooksValid && !boxIdAlreadyExists
                          ? "bg-green-50 text-green-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {boxChosen && boxIdLooksValid && !boxIdAlreadyExists
                        ? "Box-ID is bruikbaar"
                        : "Box-ID nog niet klaar"}
                    </div>
                  </div>

                  <div
                    className={`mt-4 rounded-xl px-4 py-4 text-sm font-semibold ${
                      stepOneReady
                        ? "bg-green-100 text-green-900"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {stepOneReady
                      ? "Stap 1 is inhoudelijk klaar voor de volgende fase."
                      : "Stap 1 is nog niet volledig of nog niet geldig."}
                  </div>
                </div>
              </div>

              {boxes.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-900">
                    Bestaande boxen ter referentie
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Handig om dubbele box-ID's te vermijden. Dit is puur referentie, nog geen provisioninglogica.
                  </p>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {boxes.slice(0, 8).map((box) => (
                      <div
                        key={box.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        {getBoxLabel(box)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : selectedProvisioningStep === 1 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Installatievoorbereiding aanmaken</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  In deze stap tonen we wat straks inhoudelijk aangemaakt zou moeten worden.
                  Nog niet echt wegschrijven, wel scherp maken wat de backend later moet bevestigen.
                </p>
              </div>

              {!stepOneReady ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                  Stap 1 is nog niet klaar. Kies eerst een geldige klant, site en unieke box-ID.
                  Pas daarna heeft het zin om een installatiedossier voor te bereiden.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Wat inhoudelijk vastligt
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Klant</span>
                          <span className="font-semibold text-slate-900">{customerLabel}</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Site</span>
                          <span className="font-semibold text-slate-900">{trimmedSiteId}</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Box-ID</span>
                          <span className="font-semibold text-slate-900">{normalizedBoxId}</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Sitetype</span>
                          <span className="font-semibold text-slate-900">
                            {existingSite ? "Bestaande site" : "Nieuwe site-ID"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Controle voor backendfase
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <div className="rounded-xl bg-green-50 px-4 py-3 text-green-800">
                          Klant en context zijn gekozen
                        </div>
                        <div className="rounded-xl bg-green-50 px-4 py-3 text-green-800">
                          Box-ID is uniek binnen de huidige data
                        </div>
                        <div className="rounded-xl bg-green-50 px-4 py-3 text-green-800">
                          Sitekeuze is inhoudelijk voorbereid
                        </div>
                        <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
                          Nog niets is echt aangemaakt in backend of Firestore
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">
                      Concept installatiedossier
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Dit is een werkvoorstel voor wat later door de backend gevalideerd en opgeslagen
                      moet worden. Dit is dus geen bindend contract.
                    </p>

                    <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
{conceptProvisioningDraftJson}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900">
                    De juiste volgende backendstap is later een echte create-call die dit voorstel
                    omzet in een provisioningrecord. Niet de frontend laten doen alsof dat al gebeurd is.
                  </div>
                </>
              )}
            </div>
          ) : selectedProvisioningStep === 2 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">SD-kaart klaarleggen</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Dit is bewust een simpele fysieke stap. Wout moet hier niet nadenken over software,
                  alleen zeker zijn dat hij met de juiste lege kaart werkt.
                </p>
              </div>

              {!stepOneReady ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                  Stap 1 is nog niet klaar. Kies eerst een geldige klant, site en unieke box-ID.
                  Anders weet je nog niet voor welke box je de kaart aan het voorbereiden bent.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Wat je nu fysiek moet doen
                      </div>

                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Neem een lege SD-kaart voor <strong>{normalizedBoxId}</strong>.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Steek de kaart in je pc of kaartlezer.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Controleer dat je niet per ongeluk een andere schijf of werkkaart gaat overschrijven.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Bevestig voor jezelf dat deze kaart bij klant <strong>{customerLabel}</strong> en site <strong>{trimmedSiteId}</strong> hoort.</span>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Waarom deze stap apart staat
                      </div>

                      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                        <p>
                          Omdat dit een typische foutbron is. Als Wout hier al tegelijk moet nadenken over
                          Imager, bootstrapbestanden en netwerk, gaat hij sneller een kaart of schijf verwisselen.
                        </p>
                        <p>
                          Dus eerst alleen de juiste kaart klaarleggen. Pas daarna tonen we de Imager-instellingen.
                        </p>
                      </div>

                      <div className="mt-4 rounded-xl bg-blue-50 px-4 py-4 text-sm text-blue-900">
                        Huidige context: <strong>{normalizedBoxId}</strong> voor <strong>{customerLabel}</strong> op <strong>{trimmedSiteId}</strong>.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900">
                    Deze stap bewaart nog niets. Het doel is alleen Wout rustig en foutarm naar de volgende fysieke stap te brengen.
                  </div>
                </>
              )}
            </div>
          ) : selectedProvisioningStep === 3 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Imager instellingen</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Hier moet alles zichtbaar op het scherm staan. Wout mag niets uit het hoofd moeten onthouden.
                </p>
              </div>

              {!stepOneReady ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                  Stap 1 is nog niet klaar. Eerst klant, site en geldige box-ID vastleggen.
                  Anders kunnen de Imager-instellingen nog niet betrouwbaar voorbereid worden.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Gebruik exact deze waarden
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">OS</span>
                          <span className="font-semibold text-slate-900">Raspberry Pi OS Lite 64-bit</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Hostname</span>
                          <span className="font-semibold text-slate-900">{normalizedBoxId}</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Gebruiker</span>
                          <span className="font-semibold text-slate-900">pi</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <span className="text-amber-800">Wachtwoord</span>
                          <span className="font-semibold text-amber-900">Gebruik de vaste installatiewaarde</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">SSH</span>
                          <span className="font-semibold text-slate-900">AAN</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Netwerk</span>
                          <span className="font-semibold text-slate-900">Bekabeld waar mogelijk</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Controle voor Wout
                      </div>

                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Ik heb Raspberry Pi Imager geopend.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Ik heb <strong>{normalizedBoxId}</strong> als hostname ingevuld.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Ik heb gebruiker <strong>pi</strong> en de vaste installatiewaarde gebruikt.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Ik heb SSH aangezet en de juiste kaart geselecteerd.</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Het wachtwoord is hier nog niet hard gekoppeld in de cockpit. Dat is bewust nog niet verzonnen in frontendcode. Gebruik voorlopig de afgesproken vaste installatiewaarde.
                  </div>
                </>
              )}
            </div>
          ) : selectedProvisioningStep === 4 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Opstartbestanden</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Deze stap toont welke beperkte opstartbestanden later op de kaart verwacht worden.
                  Nog geen echte download, wel duidelijk maken wat Wout straks fysiek moet doen.
                </p>
              </div>

              {!stepOneReady ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                  Stap 1 is nog niet klaar. Eerst klant, site en geldige box-ID vastleggen.
                  Anders heeft het geen zin om opstartbestanden voor te bereiden.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Bestanden die later verwacht worden
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Verplicht</span>
                          <span className="font-semibold text-slate-900">box_bootstrap.json</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Optioneel</span>
                          <span className="font-semibold text-slate-900">ssh</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-slate-500">Optioneel</span>
                          <span className="font-semibold text-slate-900">userconf.txt</span>
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                          <span className="text-blue-800">Voor deze box</span>
                          <span className="font-semibold text-blue-900">{normalizedBoxId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Wat Wout fysiek moet doen
                      </div>

                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Steek de vers gebrande kaart opnieuw in je pc.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Open de bootpartitie van de SD-kaart.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Zet de opstartbestanden in de hoofdmap van die partitie.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Controleer nog eens dat de kaart bij <strong>{normalizedBoxId}</strong> hoort voor <strong>{customerLabel}</strong>.</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Belangrijk: in de eindrichting horen hier alleen beperkte opstartbestanden te staan. Geen brede secrets en geen losse cloudsleutels als standaard.
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">
                      Wat hier bewust nog niet gebeurt
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Er is nog geen echte downloadknop of bestandsgeneratie aangesloten.
                      Dat mag pas zodra de backend later echt het provisioningrecord en de beperkte bootstrapinfo kan leveren.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : selectedProvisioningStep === 5 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Eerste opstart</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Hier begint de fysieke eerste opstart van de box. Nog geen live succes tonen,
                  maar wel duidelijk maken wat Wout nu effectief moet doen.
                </p>
              </div>

              {!stepOneReady ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                  Stap 1 is nog niet klaar. Eerst klant, site en geldige box-ID vastleggen.
                  Anders weet je nog altijd niet zeker voor welke box je de eerste opstart doet.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Wat Wout nu fysiek moet doen
                      </div>

                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Steek de voorbereide SD-kaart in de Raspberry Pi van <strong>{normalizedBoxId}</strong>.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Sluit netwerk liefst bekabeld aan als dat mogelijk is op de installatielocatie.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Geef de Pi stroom en laat de eerste opstart rustig gebeuren.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input type="checkbox" className="mt-1" />
                          <span>Trek de voeding niet te snel uit als de box niet meteen zichtbaar reageert.</span>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm font-semibold text-slate-900">
                        Wat je nu nog niet mag aannemen
                      </div>

                      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          Nog niet aannemen dat de installatie gelukt is alleen omdat de Pi stroom heeft.
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          Nog niet aannemen dat live connectie of claim al bevestigd is.
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          Nog niet automatisch naar handmatige uitzonderingen springen zolang de eerste opstart nog bezig kan zijn.
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl bg-blue-50 px-4 py-4 text-sm text-blue-900">
                        Context: <strong>{normalizedBoxId}</strong> voor <strong>{customerLabel}</strong> op <strong>{trimmedSiteId}</strong>.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900">
                    Het doel van deze stap is alleen de eerste opstart correct laten gebeuren.
                    De echte bevestiging hoort pas later in live controle of backendstatus te komen.
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">
                      Bewuste grens van deze stap
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Deze cockpit toont hier nog geen echte online-status, claim-status of heartbeat.
                      Dat zou anders opnieuw fake zekerheid geven in de UI.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {provisioningStepContent[selectedProvisioningStep].title}
              </h3>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                {provisioningStepContent[selectedProvisioningStep].text}
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">
                  Waarom deze stap nu al tonen
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Omdat de structuur van de provisioningflow eerst juist moet zitten.
                  Anders bouw je opnieuw verder op een scherm dat inhoudelijk te vaag is.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

