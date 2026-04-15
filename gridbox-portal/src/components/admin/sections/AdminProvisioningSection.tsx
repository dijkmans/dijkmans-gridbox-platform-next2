"use client";

import { getBoxLabel } from "../helpers";
import type { SiteSummary } from "../derived";
import type { AdminBoxItem, AdminProvisioningItem, CustomerItem } from "../types";

type Props = {
  customers: CustomerItem[];
  siteSummaries: SiteSummary[];
  boxes: AdminBoxItem[];
  provisioningCustomerId: string;
  provisioningSiteId: string;
  provisioningBoxId: string;
  provisioningItem?: AdminProvisioningItem | null;
  provisioningBusy: boolean;
  canRefreshProvisioning: boolean;
  canFinalizeProvisioning: boolean;
  provisioningFinalized: boolean;
  bootstrapDownloadItem?: Record<string, string> | null;
  onProvisioningCustomerChange: (value: string) => void;
  onProvisioningSiteChange: (value: string) => void;
  onProvisioningBoxIdChange: (value: string) => void;
  onCreateProvisioning: () => void | Promise<void>;
  onRefreshProvisioning: () => void | Promise<void>;
  onFinalizeProvisioning: () => void | Promise<void>;
  onDownloadSdScript: () => void | Promise<void>;
  onMarkSdPrepared: () => void | Promise<void>;
  onResetProvisioning: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_sd_preparation: "SD-kaart voorbereiden",
  awaiting_first_boot: "Wacht op eerste opstart",
  claimed: "Pi geclaimd",
  online: "Online",
  ready: "Klaar",
  failed: "Mislukt",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  awaiting_sd_preparation: "bg-amber-100 text-amber-800",
  awaiting_first_boot: "bg-amber-100 text-amber-800",
  claimed: "bg-blue-100 text-blue-800",
  online: "bg-green-100 text-green-800",
  ready: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function BlockHeader({
  num,
  title,
  complete,
  active,
}: {
  num: number;
  title: string;
  complete: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          complete
            ? "bg-green-500 text-white"
            : active
            ? "bg-slate-900 text-white"
            : "bg-slate-200 text-slate-500"
        }`}
      >
        {complete ? "✓" : num}
      </div>
      <h3 className={`text-lg font-bold ${active || complete ? "text-slate-900" : "text-slate-400"}`}>
        {title}
      </h3>
    </div>
  );
}

export default function AdminProvisioningSection({
  customers,
  siteSummaries,
  boxes,
  provisioningCustomerId,
  provisioningSiteId,
  provisioningBoxId,
  provisioningItem,
  provisioningBusy,
  canRefreshProvisioning,
  canFinalizeProvisioning,
  provisioningFinalized,
  bootstrapDownloadItem,
  onProvisioningCustomerChange,
  onProvisioningSiteChange,
  onProvisioningBoxIdChange,
  onCreateProvisioning,
  onRefreshProvisioning,
  onFinalizeProvisioning,
  onDownloadSdScript,
  onMarkSdPrepared,
  onResetProvisioning,
}: Props) {
  const sortedCustomers = [...customers].sort((a, b) =>
    (a.name || a.id).localeCompare(b.name || b.id)
  );
  const sortedSites = [...siteSummaries].sort((a, b) => a.siteId.localeCompare(b.siteId));

  const selectedCustomer = customers.find((c) => c.id === provisioningCustomerId);
  const customerChosen = provisioningCustomerId.trim().length > 0;
  const customerScopedSites = selectedCustomer
    ? sortedSites.filter((s) => s.customerIds.has(selectedCustomer.id.toLowerCase()))
    : [];

  const trimmedSiteId = provisioningSiteId.trim();
  const trimmedBoxId = provisioningBoxId.trim();
  const normalizedBoxId = trimmedBoxId.toLowerCase();
  const existingBoxIds = new Set(
    boxes.map((b) => (b.boxId || b.id).trim().toLowerCase()).filter(Boolean)
  );
  const existingSite = customerScopedSites.find((s) => s.siteId === trimmedSiteId) || null;
  const boxIdLooksValid = trimmedBoxId.length > 0 && /^[a-z0-9-]+$/.test(trimmedBoxId);
  const boxIdAlreadyExists = trimmedBoxId.length > 0 && existingBoxIds.has(normalizedBoxId);
  const stepOneReady =
    customerChosen &&
    Boolean(existingSite) &&
    trimmedBoxId.length > 0 &&
    boxIdLooksValid &&
    !boxIdAlreadyExists;

  const provisioningExists = Boolean(provisioningItem?.id);
  const status = provisioningItem?.status || "";
  const statusLabel = STATUS_LABELS[status] || status || "-";
  const statusColor = STATUS_COLORS[status] || "bg-slate-100 text-slate-700";
  const customerLabel =
    selectedCustomer?.name || provisioningCustomerId || provisioningItem?.customerId || "-";

  const block1Complete = provisioningExists;
  const block2Complete = ["awaiting_first_boot", "claimed", "online", "ready"].includes(status);
  const piIsOnline = status === "online" || status === "ready";
  const sdScriptDownloaded = Boolean(bootstrapDownloadItem?.bootstrapToken);

  // Finalized success screen
  if (provisioningFinalized) {
    return (
      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Installatiecockpit</h2>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-emerald-900">
            Installatie voltooid voor {provisioningItem?.boxId || "-"}
          </h2>
          <p className="mt-2 text-sm text-emerald-700">
            De box is opgezet voor {customerLabel} op {provisioningItem?.siteId || "-"}.
          </p>
          <button
            type="button"
            onClick={onResetProvisioning}
            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            Nieuwe box installeren
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Installatiecockpit</h2>
        <p className="mt-1 text-sm text-slate-500">
          Volg de stappen hieronder om een nieuwe Gridbox te installeren.
        </p>
      </div>

      {/* ═══ BLOK 1: Nieuwe box voorbereiden ═══ */}
      <div
        className={`rounded-3xl border p-6 shadow-sm transition ${
          block1Complete ? "border-green-200 bg-green-50" : "border-slate-900 bg-white"
        }`}
      >
        <BlockHeader num={1} title="Nieuwe box voorbereiden" complete={block1Complete} active={!block1Complete} />

        {block1Complete ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-green-800">
            <span className="font-semibold">{provisioningItem?.boxId}</span>
            <span className="text-green-600">voor</span>
            <span className="font-semibold">{provisioningItem?.customerId}</span>
            <span className="text-green-600">/</span>
            <span className="font-semibold">{provisioningItem?.siteId}</span>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              {/* Klant */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Klant</label>
                <select
                  value={provisioningCustomerId}
                  onChange={(e) => onProvisioningCustomerChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="">-- Kies een klant --</option>
                  {sortedCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.id}</option>
                  ))}
                </select>
              </div>

              {/* Site */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Site</label>
                {customerChosen && customerScopedSites.length === 0 ? (
                  <>
                    <input
                      value={provisioningSiteId}
                      onChange={(e) => onProvisioningSiteChange(e.target.value)}
                      placeholder="bijv. site-klant-001"
                      className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500"
                    />
                    <p className="mt-1 text-xs text-amber-700">
                      Nog geen sites voor deze klant. Vul een nieuwe site-ID in.
                    </p>
                  </>
                ) : (
                  <select
                    value={provisioningSiteId}
                    onChange={(e) => onProvisioningSiteChange(e.target.value)}
                    disabled={!customerChosen}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">
                      {!customerChosen ? "-- Kies eerst een klant --" : "-- Kies een site --"}
                    </option>
                    {customerScopedSites.map((s) => (
                      <option key={s.siteId} value={s.siteId}>{s.siteId}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Box-ID */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Nieuwe box-ID</label>
                <input
                  value={provisioningBoxId}
                  onChange={(e) => onProvisioningBoxIdChange(e.target.value)}
                  placeholder="bv. gbox-007"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                />
                {trimmedBoxId.length > 0 && !boxIdLooksValid && (
                  <p className="mt-1 text-xs text-red-600">
                    Ongeldig formaat. Gebruik alleen kleine letters, cijfers en koppeltekens.
                  </p>
                )}
                {trimmedBoxId.length > 0 && boxIdLooksValid && boxIdAlreadyExists && (
                  <p className="mt-1 text-xs text-red-600">Deze box-ID bestaat al. Kies een andere.</p>
                )}
                {trimmedBoxId.length > 0 && boxIdLooksValid && !boxIdAlreadyExists && (
                  <p className="mt-1 text-xs text-green-700">Box-ID ziet er goed uit.</p>
                )}
              </div>
            </div>

            {boxes.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-500">Bestaande boxen</div>
                <div className="flex flex-wrap gap-2">
                  {boxes.slice(0, 12).map((b) => (
                    <span key={b.id} className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {getBoxLabel(b)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onCreateProvisioning}
              disabled={!stepOneReady || provisioningBusy}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {provisioningBusy ? <><Spinner /> Bezig...</> : "Aanmaken en doorgaan"}
            </button>
          </div>
        )}
      </div>

      {/* ═══ BLOK 2: SD-kaart voorbereiden ═══ */}
      {provisioningExists && (
        <div
          className={`rounded-3xl border p-6 shadow-sm transition ${
            block2Complete ? "border-green-200 bg-green-50" : "border-slate-900 bg-white"
          }`}
        >
          <BlockHeader num={2} title="SD-kaart voorbereiden" complete={block2Complete} active={!block2Complete} />

          {block2Complete ? (
            <div className="text-sm font-semibold text-green-800">SD-kaart klaar — Pi aangesloten</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <span className="font-semibold">✅ {provisioningItem?.boxId}</span>{" "}
                aangemaakt voor{" "}
                <span className="font-semibold">{provisioningItem?.customerId}</span>{" / "}
                <span className="font-semibold">{provisioningItem?.siteId}</span>
              </div>

              <p className="text-sm text-slate-600">
                Neem een lege SD-kaart (minimaal 16 GB) en steek hem in je pc of kaartlezer.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://storage.googleapis.com/gridbox-platform.firebasestorage.app/master-images/Gridbox_master_v1.0.60.img.gz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  ⬇ Master image downloaden
                </a>

                <button
                  type="button"
                  onClick={onDownloadSdScript}
                  disabled={provisioningBusy}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {provisioningBusy ? <><Spinner /> Bezig...</> : "📥 SD-script downloaden"}
                </button>
              </div>

              {sdScriptDownloaded && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                    ✅ SD-script gedownload
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-3 text-sm font-semibold text-slate-900">Instructies</div>
                    <div className="space-y-2 text-sm text-slate-700">
                      {[
                        "Voer het gedownloade .ps1 script uit in PowerShell als administrator",
                        "Volg de instructies op het scherm",
                        "Wacht tot het script meldt dat de SD-kaart klaar is",
                        "Haal de SD-kaart uit je pc of kaartlezer",
                        "Steek de SD-kaart in de Raspberry Pi",
                        "Sluit de Raspberry Pi aan op stroom en netwerk",
                      ].map((step, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                        >
                          <span className="flex-shrink-0 font-bold text-slate-400">{i + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onMarkSdPrepared}
                    disabled={provisioningBusy}
                    className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {provisioningBusy ? "Bezig..." : "SD-kaart klaar — Pi aansluiten"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ BLOK 3: Wachten op Pi ═══ */}
      {block2Complete && (
        <div className="rounded-3xl border border-slate-900 bg-white p-6 shadow-sm">
          <BlockHeader num={3} title="Wachten op Pi" complete={false} active={true} />

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                {statusLabel}
              </span>
              {provisioningItem?.lastHeartbeatAt && (
                <span className="text-xs text-slate-500">
                  Laatste heartbeat: {provisioningItem.lastHeartbeatAt}
                </span>
              )}
            </div>

            {!piIsOnline && (
              <p className="text-sm text-slate-600">De Pi wordt opgestart. Dit kan 2–3 minuten duren.</p>
            )}

            {piIsOnline && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                ✅ Pi is online en operationeel
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onRefreshProvisioning}
                disabled={!canRefreshProvisioning}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🔄 Ververs status
              </button>

              {piIsOnline && (
                <button
                  type="button"
                  onClick={onFinalizeProvisioning}
                  disabled={!canFinalizeProvisioning}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {provisioningBusy ? <><Spinner /> Bezig...</> : "Installatie afronden"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
