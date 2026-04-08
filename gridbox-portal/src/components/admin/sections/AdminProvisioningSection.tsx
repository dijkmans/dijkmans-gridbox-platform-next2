"use client";

import { useEffect, useRef, useState } from "react";
import { getBoxLabel } from "../helpers";
import type { SiteSummary } from "../derived";
import type {
  AdminBoxItem,
  AdminProvisioningItem,
  CustomerItem,
  ProvisioningStepContent,
} from "../types";

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
  provisioningItem?: AdminProvisioningItem | null;
  provisioningLookupId: string;
  provisioningBusy: boolean;
  provisioningStatusLabel: string;
  canRefreshProvisioning: boolean;
  canFinalizeProvisioning: boolean;
  onProvisioningCustomerChange: (value: string) => void;
  onProvisioningSiteChange: (value: string) => void;
  onProvisioningBoxIdChange: (value: string) => void;
  onProvisioningLookupIdChange: (value: string) => void;
  onCreateProvisioning: () => void | Promise<void>;
  onRefreshProvisioning: () => void | Promise<void>;
  onFinalizeProvisioning: () => void | Promise<void>;
  bootstrapDownloadItem?: Record<string, string> | null;
  onPrepareBootstrapDownload?: () => void | Promise<void>;
  onGenerateScript?: () => void | Promise<void>;
  onMarkSdPrepared?: () => void | Promise<void>;
  onStepChange: (step: number) => void;
  onSuggestBoxId?: () => Promise<string | null>;
};

const STEPS = [
  "Nieuwe box voorbereiden",
  "Installatievoorbereiding aanmaken",
  "SD-kaart flashen",
  "Opstartbestanden",
  "Eerste opstart",
  "Live controle",
  "Installatie voltooid",
] as const;

// ─── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400 text-sm">—</span>;
  const cls =
    status === "online" || status === "ready"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : status === "claimed" || status === "awaiting_first_boot"
        ? "bg-blue-50 text-blue-800 border border-blue-200"
        : status === "awaiting_sd_preparation"
          ? "bg-amber-50 text-amber-800 border border-amber-200"
          : status === "failed"
            ? "bg-amber-50 text-amber-800 border border-amber-200"
            : "bg-slate-100 text-slate-600 border border-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {status}
    </span>
  );
}

function KVRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "amber" | "blue";
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl px-3.5 py-2.5 text-sm border ${
        accent === "amber"
          ? "bg-amber-50 border-amber-200"
          : accent === "blue"
            ? "bg-blue-50 border-blue-200"
            : "bg-slate-50 border-slate-200"
      }`}
    >
      <span
        className={
          accent === "amber"
            ? "text-amber-700 shrink-0"
            : accent === "blue"
              ? "text-blue-700 shrink-0"
              : "text-slate-500 shrink-0"
        }
      >
        {label}
      </span>
      <span
        className={`font-semibold text-right break-all ${mono ? "font-mono text-xs" : "text-sm"} ${
          accent === "amber"
            ? "text-amber-900"
            : accent === "blue"
              ? "text-blue-900"
              : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function AdminProvisioningSection({
  selectedProvisioningStep,
  provisioningSteps: _provisioningSteps,
  provisioningStepContent: _provisioningStepContent,
  customers,
  siteSummaries,
  boxes,
  provisioningCustomerId,
  provisioningSiteId,
  provisioningBoxId,
  provisioningItem,
  provisioningLookupId,
  provisioningBusy,
  provisioningStatusLabel,
  canRefreshProvisioning,
  canFinalizeProvisioning,
  onProvisioningCustomerChange,
  onProvisioningSiteChange,
  onProvisioningBoxIdChange,
  onProvisioningLookupIdChange,
  onCreateProvisioning,
  onRefreshProvisioning,
  onFinalizeProvisioning,
  bootstrapDownloadItem,
  onPrepareBootstrapDownload,
  onGenerateScript,
  onMarkSdPrepared,
  onStepChange,
  onSuggestBoxId,
}: AdminProvisioningSectionProps) {
  const [suggestBusy, setSuggestBusy] = useState(false);
  const autoSuggestedRef = useRef(false);

  // Auto-suggest box ID on load
  useEffect(() => {
    if (
      selectedProvisioningStep === 0 &&
      !provisioningBoxId &&
      !autoSuggestedRef.current &&
      onSuggestBoxId
    ) {
      autoSuggestedRef.current = true;
      setSuggestBusy(true);
      onSuggestBoxId()
        .then((suggested) => {
          if (suggested) onProvisioningBoxIdChange(suggested);
        })
        .finally(() => setSuggestBusy(false));
    }
  }, [selectedProvisioningStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance on status change
  useEffect(() => {
    if (!provisioningItem?.status) return;
    const s = provisioningItem.status;
    if ((s === "online" || s === "ready") && selectedProvisioningStep < 6) {
      onStepChange(6);
    } else if (s === "claimed" && selectedProvisioningStep < 5) {
      onStepChange(5);
    }
  }, [provisioningItem?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived values ──────────────────────────────────────────────────────

  const sortedCustomers = [...customers].sort((a, b) =>
    (a.name || a.id).localeCompare(b.name || b.id)
  );
  const sortedSites = [...siteSummaries].sort((a, b) =>
    a.siteId.localeCompare(b.siteId)
  );

  const selectedCustomer = customers.find(
    (c) => c.id === provisioningCustomerId
  );
  const customerChosen = provisioningCustomerId.trim().length > 0;
  const customerScopedSites = selectedCustomer
    ? sortedSites.filter((s) =>
        s.customerIds.has(selectedCustomer.id.toLowerCase())
      )
    : [];

  const trimmedSiteId = provisioningSiteId.trim();
  const trimmedBoxId = provisioningBoxId.trim();
  const normalizedBoxId = trimmedBoxId.toLowerCase();

  const existingBoxIds = new Set(
    boxes
      .map((b) => (b.boxId || b.id).trim().toLowerCase())
      .filter(Boolean)
  );

  const existingSite =
    customerScopedSites.find((s) => s.siteId === trimmedSiteId) || null;
  const siteExistsOutsideSelectedCustomer =
    trimmedSiteId.length > 0 && !existingSite
      ? sortedSites.find((s) => s.siteId === trimmedSiteId) || null
      : null;

  const boxIdLooksValid =
    trimmedBoxId.length > 0 && /^[a-z0-9-]+$/.test(trimmedBoxId);
  const boxIdAlreadyExists =
    trimmedBoxId.length > 0 && existingBoxIds.has(normalizedBoxId);

  const siteChosen = Boolean(existingSite);
  const boxChosen = trimmedBoxId.length > 0;

  const stepOneReady =
    customerChosen &&
    siteChosen &&
    boxChosen &&
    boxIdLooksValid &&
    !boxIdAlreadyExists;

  const customerLabel =
    selectedCustomer?.name || provisioningCustomerId || "-";
  const provisioningExists = Boolean(provisioningItem?.id);
  const provisioningIdLabel = provisioningItem?.id || "-";
  const provisioningCreatedAt = provisioningItem?.createdAt || "-";
  const provisioningClaimedAt = provisioningItem?.claimedAt || "-";
  const provisioningLastHeartbeatAt = provisioningItem?.lastHeartbeatAt || "-";
  const provisioningFinalizedAt = provisioningItem?.finalizedAt || "-";

  const canCreateProvisioning =
    stepOneReady && !provisioningBusy && !provisioningExists;
  const canPrepareBootstrapDownload =
    provisioningExists &&
    !provisioningBusy &&
    Boolean(onPrepareBootstrapDownload);
  const canGenerateScript =
    provisioningExists && !provisioningBusy && Boolean(onGenerateScript);
  const canMarkSdPrepared =
    provisioningExists &&
    !provisioningBusy &&
    Boolean(onMarkSdPrepared) &&
    (provisioningItem?.status === "draft" ||
      provisioningItem?.status === "awaiting_sd_preparation");
  const hasBootstrapDownloadItem = Boolean(
    bootstrapDownloadItem?.bootstrapToken
  );

  const scriptFilename = `gridbox-sd-${normalizedBoxId || "gbox-xxx"}.bat`;

  // Step nav state helper
  const getStepState = (idx: number) => {
    if (idx < selectedProvisioningStep) return "done";
    if (idx === selectedProvisioningStep) return "active";
    return "waiting";
  };

  // ─── Info panel (right side of step 2) ───────────────────────────────────

  const InfoPanel = () => (
    <div className="flex flex-col gap-3">
      {/* Installatie card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Installatie
          </span>
        </div>
        {(
          [
            ["Box-ID", normalizedBoxId || "—", true],
            ["Klant", customerLabel, false],
            ["Site", trimmedSiteId || "—", true],
            ["Status", provisioningItem?.status || "—", true],
            ["Script", scriptFilename, true],
          ] as [string, string, boolean][]
        ).map(([label, value, mono]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-slate-50 px-3.5 py-2 text-xs last:border-0"
          >
            <span className="shrink-0 text-slate-500">{label}</span>
            <span
              className={`text-right font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Tijdsinschatting card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Tijdsinschatting
          </span>
        </div>
        {(
          [
            ["Bootstrap voorbereiden", "< 5 sec"],
            ["Script downloaden", "~30 sec"],
            ["Image downloaden (1e keer)", "~5 min"],
            ["Flashen", "~8 min"],
            ["Bootstrap schrijven", "~30 sec"],
            ["Totaal", "~12–15 min"],
          ] as [string, string][]
        ).map(([label, time], i) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-3 border-b border-slate-50 px-3.5 py-2 text-xs last:border-0 ${
              i === 5 ? "font-bold text-slate-900" : "text-slate-500"
            }`}
          >
            <span>{label}</span>
            <span className={i === 5 ? "text-slate-900" : "font-medium text-slate-700"}>
              {time}
            </span>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
        <strong>SD-kaart minimaal 32 GB vereist.</strong> Gebruik klasse 10 of
        beter. Een te kleine kaart veroorzaakt problemen bij de eerste opstart.
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section>
      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        {/* ── Card header ── */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-7 py-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Installatiecockpit
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              We bouwen deze cockpit stap voor stap uit. Alleen echte
              voorbereiding, geen fake provisioningstatus en geen verzonnen
              succes.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Alleen voor platformbeheer
          </span>
        </div>

        {/* ── Status bar ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-slate-50/80 px-7 py-3.5">
          <span className="text-xs text-slate-500">Status:</span>
          <StatusBadge status={provisioningItem?.status} />
          {provisioningItem?.id && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-xs text-slate-500">Provisioning:</span>
              <span className="font-mono text-xs font-semibold text-slate-700">
                {provisioningItem.id.length > 16
                  ? `${provisioningItem.id.slice(0, 16)}…`
                  : provisioningItem.id}
              </span>
            </>
          )}
          <span className="text-slate-200">·</span>
          <span className="text-xs text-slate-500">Box:</span>
          <strong className="text-xs font-semibold text-slate-900">
            {provisioningItem?.boxId || normalizedBoxId || "—"}
          </strong>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onRefreshProvisioning}
              disabled={!canRefreshProvisioning}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vernieuwen
            </button>
            <button
              type="button"
              onClick={onFinalizeProvisioning}
              disabled={!canFinalizeProvisioning}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Installatie afronden
            </button>
          </div>
        </div>

        {/* ── Lookup bar ── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-7 py-4">
          <span className="shrink-0 text-sm font-semibold text-slate-700">
            Bestaand record laden:
          </span>
          <input
            type="text"
            value={provisioningLookupId}
            onChange={(e) => onProvisioningLookupIdChange(e.target.value)}
            placeholder="Provisioning ID"
            className="w-64 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
          />
          <button
            type="button"
            onClick={onRefreshProvisioning}
            disabled={!canRefreshProvisioning}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Laden
          </button>
        </div>

        {/* ── Body: step nav + content ── */}
        <div className="grid gap-6 p-7 [grid-template-columns:260px_1fr]">

          {/* Step navigation */}
          <nav className="flex flex-col gap-2">
            {STEPS.map((stepLabel, idx) => {
              const state = getStepState(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onStepChange(idx)}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                    state === "active"
                      ? "border-slate-900 bg-slate-900"
                      : state === "done"
                        ? "border-slate-200 bg-slate-50 opacity-80 hover:opacity-100 hover:bg-white"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  {/* Indicator circle */}
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      state === "active"
                        ? "bg-white text-slate-900"
                        : state === "done"
                          ? "border border-slate-200 bg-slate-100 text-slate-400"
                          : "border border-slate-200 bg-slate-100 text-slate-300"
                    }`}
                  >
                    {state === "done" ? "✓" : idx + 1}
                  </div>
                  {/* Meta */}
                  <div className="min-w-0">
                    <div
                      className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                        state === "active" ? "text-slate-400" : "text-slate-400"
                      }`}
                    >
                      Stap {idx + 1}
                    </div>
                    <div
                      className={`mt-1 text-[13px] font-bold leading-tight ${
                        state === "active"
                          ? "text-white"
                          : state === "done"
                            ? "text-slate-400"
                            : "text-slate-700"
                      }`}
                    >
                      {stepLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* ── Step content ── */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">

            {/* ════ STAP 0: Nieuwe box voorbereiden ════ */}
            {selectedProvisioningStep === 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Nieuwe box voorbereiden
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Kies de klant, de locatie (site) en geef de nieuwe box een
                    ID. Het systeem stelt automatisch het volgende vrije nummer
                    voor.
                  </p>
                </div>

                {/* Selectors */}
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">
                      Klant
                    </div>
                    <select
                      value={provisioningCustomerId}
                      onChange={(e) =>
                        onProvisioningCustomerChange(e.target.value)
                      }
                      className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    >
                      <option value="">— Kies een klant —</option>
                      {sortedCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">
                      Site
                    </div>
                    <select
                      value={provisioningSiteId}
                      onChange={(e) =>
                        onProvisioningSiteChange(e.target.value)
                      }
                      disabled={!customerChosen}
                      className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {customerChosen
                          ? "— Kies een site —"
                          : "— Eerst een klant kiezen —"}
                      </option>
                      {customerScopedSites.map((s) => (
                        <option key={s.siteId} value={s.siteId}>
                          {s.siteId}
                        </option>
                      ))}
                    </select>
                    {siteExistsOutsideSelectedCustomer && (
                      <p className="mt-2 text-xs text-amber-700">
                        Deze site bestaat maar hoort bij een andere klant.
                      </p>
                    )}
                  </div>
                </div>

                {/* Box-ID */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-900">
                    Box-ID
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={provisioningBoxId}
                      onChange={(e) =>
                        onProvisioningBoxIdChange(e.target.value)
                      }
                      placeholder="gbox-001"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    />
                    {onSuggestBoxId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestBusy(true);
                          onSuggestBoxId()
                            .then((v) => {
                              if (v) onProvisioningBoxIdChange(v);
                            })
                            .finally(() => setSuggestBusy(false));
                        }}
                        disabled={suggestBusy}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {suggestBusy ? "…" : "Suggereer"}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-xs">
                    {boxChosen && !boxIdLooksValid && (
                      <span className="text-red-600">
                        Ongeldig formaat. Gebruik alleen kleine letters, cijfers
                        en koppeltekens.
                      </span>
                    )}
                    {boxChosen && boxIdLooksValid && boxIdAlreadyExists && (
                      <span className="text-red-600">
                        Deze box-ID bestaat al. Kies een nieuwe unieke box-ID.
                      </span>
                    )}
                    {boxChosen &&
                      boxIdLooksValid &&
                      !boxIdAlreadyExists &&
                      trimmedBoxId !== normalizedBoxId && (
                        <span className="text-amber-700">
                          Voorstel: gebruik kleine letters → {normalizedBoxId}
                        </span>
                      )}
                    {boxChosen &&
                      boxIdLooksValid &&
                      !boxIdAlreadyExists &&
                      trimmedBoxId === normalizedBoxId && (
                        <span className="text-emerald-700">
                          Box-ID-formaat ziet er goed uit.
                        </span>
                      )}
                  </div>
                </div>

                {/* Summary + validation */}
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 text-sm font-semibold text-slate-900">
                      Samenvatting
                    </div>
                    <div className="space-y-2.5">
                      <KVRow label="Klant" value={customerLabel} />
                      <KVRow label="Site" value={trimmedSiteId || "—"} mono />
                      <KVRow
                        label="Box-ID"
                        value={provisioningItem?.boxId || normalizedBoxId || "—"}
                        mono
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 text-sm font-semibold text-slate-900">
                      Controle
                    </div>
                    <div className="space-y-2">
                      {(
                        [
                          [customerChosen, "Klant gekozen", "Nog geen klant"],
                          [
                            siteChosen,
                            "Site gekozen",
                            customerChosen
                              ? "Kies een site"
                              : "Eerst klant kiezen",
                          ],
                          [
                            boxChosen && boxIdLooksValid && !boxIdAlreadyExists,
                            "Box-ID bruikbaar",
                            "Box-ID nog niet klaar",
                          ],
                        ] as [boolean, string, string][]
                      ).map(([ok, yesLabel, noLabel], i) => (
                        <div
                          key={i}
                          className={`rounded-xl px-4 py-3 text-sm ${
                            ok
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ok ? yesLabel : noLabel}
                        </div>
                      ))}
                    </div>
                    <div
                      className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
                        stepOneReady
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {stepOneReady
                        ? "Klaar voor de volgende stap."
                        : "Nog niet volledig of geldig."}
                    </div>
                  </div>
                </div>

                {/* Bestaande boxen referentie */}
                {boxes.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm font-semibold text-slate-900">
                      Bestaande boxen ter referentie
                    </div>
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
            )}

            {/* ════ STAP 1: Installatievoorbereiding aanmaken ════ */}
            {selectedProvisioningStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Installatievoorbereiding aanmaken
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Het systeem maakt nu een uniek installatierecord aan in de
                    cloud. Dit record bevat een beveiligde sleutel die de Pi bij
                    eerste opstart gebruikt om zichzelf te registreren.
                  </p>
                </div>

                {!stepOneReady ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Stap 1 is nog niet klaar. Kies eerst een geldige klant,
                    site en unieke box-ID.
                  </div>
                ) : !provisioningExists ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Klaar om aan te maken
                        </div>
                        <div className="space-y-2.5">
                          <KVRow label="Klant" value={customerLabel} />
                          <KVRow label="Site" value={trimmedSiteId} mono />
                          <KVRow label="Box-ID" value={normalizedBoxId} mono />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="text-sm font-semibold text-slate-900">
                          Huidige backendtoestand
                        </div>
                        <div className="mt-4 space-y-3 text-sm leading-7">
                          <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
                            Nog geen provisioningrecord gekoppeld.
                          </div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3 text-slate-600">
                            Na aanmaken geeft de backend status en ID terug.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onCreateProvisioning}
                          disabled={!canCreateProvisioning}
                          className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {provisioningBusy
                            ? "Bezig..."
                            : "Aanmaken in backend"}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900">
                      Deze stap is pas geslaagd wanneer de backend effectief
                      een provisioningrecord terugstuurt.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Provisioningrecord aangemaakt
                        </div>
                        <div className="space-y-2.5">
                          <KVRow
                            label="Provisioning ID"
                            value={provisioningIdLabel}
                            mono
                          />
                          <KVRow
                            label="Status"
                            value={provisioningStatusLabel}
                          />
                          <KVRow
                            label="Klant"
                            value={provisioningItem?.customerId || "—"}
                          />
                          <KVRow
                            label="Site"
                            value={provisioningItem?.siteId || "—"}
                            mono
                          />
                          <KVRow
                            label="Box-ID"
                            value={provisioningItem?.boxId || "—"}
                            mono
                          />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Live tijdstempels
                        </div>
                        <div className="space-y-2.5">
                          <KVRow
                            label="Aangemaakt"
                            value={provisioningCreatedAt}
                          />
                          <KVRow
                            label="Geclaimd"
                            value={provisioningClaimedAt}
                          />
                          <KVRow
                            label="Heartbeat"
                            value={provisioningLastHeartbeatAt}
                          />
                          <KVRow
                            label="Afgerond"
                            value={provisioningFinalizedAt}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={onRefreshProvisioning}
                          disabled={!canRefreshProvisioning}
                          className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Ververs status
                        </button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-800">
                      Provisioningrecord bevestigd door backend. Klaar voor de
                      volgende stap.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════ STAP 2: SD-kaart flashen ════ */}
            {selectedProvisioningStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    SD-kaart flashen
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Het script flasht het master image op de SD-kaart en
                    schrijft automatisch de bootstrap-bestanden. Volg de stappen
                    in het zwarte venster.
                  </p>
                </div>

                {!stepOneReady && !provisioningExists ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Maak eerst een installatievoorbereiding aan in stap 2.
                  </div>
                ) : (
                  <>
                    {/* Actieknoppen */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => onPrepareBootstrapDownload?.()}
                        disabled={!canPrepareBootstrapDownload}
                        className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {provisioningBusy ? "Bezig..." : "Bootstrap voorbereiden"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateScript?.()}
                        disabled={!canGenerateScript}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        SD-script downloaden
                      </button>
                      <button
                        type="button"
                        onClick={() => onMarkSdPrepared?.()}
                        disabled={!canMarkSdPrepared}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        SD-kaart als klaar markeren
                      </button>
                    </div>

                    {/* 2-column: substeps + info panel */}
                    <div className="grid gap-5 [grid-template-columns:1fr_256px]">

                      {/* Substappen */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-5 text-sm font-semibold text-slate-900">
                          Stappen in volgorde
                        </div>
                        <div className="flex flex-col">
                          {(
                            [
                              {
                                title: "SD-kaart insteken",
                                body: (
                                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                    Steek de SD-kaart van minimaal 32 GB in je
                                    pc. Het script detecteert hem automatisch.
                                  </p>
                                ),
                              },
                              {
                                title: "Script uitvoeren",
                                body: (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Dubbelklik op{" "}
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                      {scriptFilename}
                                    </span>{" "}
                                    en klik Ja bij de UAC-melding.
                                  </p>
                                ),
                              },
                              {
                                title: "Typ JA om te bevestigen",
                                body: (
                                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                    Controleer de schijf in het zwarte venster
                                    en typ{" "}
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                      JA
                                    </span>{" "}
                                    om het flashen te starten.
                                  </p>
                                ),
                              },
                              {
                                title: "Wacht tot rpi-imager klaar is (~8 min)",
                                body: (
                                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                    rpi-imager opent automatisch en flasht het
                                    master image. Wacht tot 100% en druk dan op
                                    Enter.
                                  </p>
                                ),
                              },
                              {
                                title: "SD-kaart herinsteken",
                                body: (
                                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                    Verwijder de kaart kort, wacht op het
                                    Windows geluid en steek hem terug in. Druk
                                    daarna op Enter.
                                  </p>
                                ),
                              },
                              {
                                title:
                                  "Bootstrap bestanden worden automatisch geschreven",
                                body: (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Het script schrijft{" "}
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                      box_bootstrap.json
                                    </span>{" "}
                                    en{" "}
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                      service-account.json
                                    </span>{" "}
                                    naar de bootpartitie.
                                  </p>
                                ),
                              },
                            ] as { title: string; body: React.ReactNode }[]
                          ).map((substep, si) => (
                            <div
                              key={si}
                              className="relative flex gap-3.5 pb-5 last:pb-0"
                            >
                              {/* Connector line */}
                              {si < 5 && (
                                <div className="absolute left-[11px] top-[26px] w-px bg-slate-200"
                                  style={{ height: "calc(100% - 10px)" }}
                                />
                              )}
                              {/* Circle indicator */}
                              <div className="relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-400">
                                {si + 1}
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-700">
                                  {substep.title}
                                </div>
                                {substep.body}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Info panel */}
                      <InfoPanel />
                    </div>

                    {/* Bootstrap download details */}
                    {hasBootstrapDownloadItem && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Bootstrap download klaar
                        </div>
                        <div className="grid gap-2.5 md:grid-cols-2">
                          <KVRow
                            label="Provisioning ID"
                            value={bootstrapDownloadItem?.provisioningId || "—"}
                            mono
                          />
                          <KVRow
                            label="Box ID"
                            value={bootstrapDownloadItem?.boxId || "—"}
                            mono
                          />
                          <div className="md:col-span-2">
                            <KVRow
                              label="Bootstrap token"
                              value={
                                bootstrapDownloadItem?.bootstrapToken || "—"
                              }
                              mono
                            />
                          </div>
                          <div className="md:col-span-2">
                            <KVRow
                              label="API base URL"
                              value={bootstrapDownloadItem?.apiBaseUrl || "—"}
                              mono
                            />
                          </div>
                          <KVRow
                            label="Versie"
                            value={
                              bootstrapDownloadItem?.bootstrapVersion || "—"
                            }
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ════ STAP 3: Opstartbestanden ════ */}
            {selectedProvisioningStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Opstartbestanden
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Het script heeft automatisch de juiste bestanden op de
                    SD-kaart gezet. Controleer alleen of de kaart bij de juiste
                    box hoort.
                  </p>
                </div>

                {!stepOneReady && !provisioningExists ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Maak eerst een installatievoorbereiding aan in stap 2.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Bestanden op bootpartitie
                        </div>
                        <div className="space-y-2.5">
                          <KVRow
                            label="Verplicht"
                            value="box_bootstrap.json"
                            mono
                          />
                          <KVRow
                            label="Automatisch"
                            value="service-account.json"
                            mono
                          />
                          <KVRow
                            label="Voor deze box"
                            value={provisioningItem?.boxId || normalizedBoxId || "—"}
                            mono
                            accent="blue"
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Snelle check
                        </div>
                        <div className="space-y-2.5 text-sm text-slate-700">
                          {[
                            `Kaart is voor ${normalizedBoxId || "de juiste box"}`,
                            `Klant: ${customerLabel}`,
                            `Site: ${trimmedSiteId || "—"}`,
                            "Script is volledig afgelopen",
                          ].map((item) => (
                            <label
                              key={item}
                              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <input type="checkbox" className="mt-0.5" />
                              <span>{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                      Alleen beperkte opstartbestanden horen op de SD-kaart.
                      Geen brede secrets als standaard.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════ STAP 4: Eerste opstart ════ */}
            {selectedProvisioningStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Eerste opstart
                  </h3>
                  <ol className="mt-3 max-w-2xl list-decimal list-inside space-y-1 text-sm leading-7 text-slate-600">
                    <li>Steek de SD-kaart in de Raspberry Pi</li>
                    <li>Sluit de voeding aan</li>
                    <li>Wacht 2–3 minuten</li>
                    <li>
                      Controleer of de status{" "}
                      <strong>claimed</strong> of <strong>online</strong> toont
                    </li>
                    <li>
                      Klik <strong>Installatie afronden</strong> als de Pi
                      online is
                    </li>
                  </ol>
                </div>

                {!stepOneReady && !provisioningExists ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Maak eerst een installatievoorbereiding aan in stap 2.
                  </div>
                ) : (
                  <>
                    {/* Backendstatus */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Backendstatus
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Na SD-kaart als klaar markeren verwacht je hier
                            eerst <em>awaiting_first_boot</em>. Na opstart{" "}
                            <em>claimed</em>.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onRefreshProvisioning}
                          disabled={!canRefreshProvisioning}
                          className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Ververs status
                        </button>
                      </div>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Huidige status
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <StatusBadge status={provisioningItem?.status} />
                          <span className="text-sm text-slate-500">
                            {provisioningStatusLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      {/* Checklist */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Wat nu fysiek moet gebeuren
                        </div>
                        <div className="space-y-2.5 text-sm text-slate-700">
                          {[
                            `SD-kaart in ${normalizedBoxId || "de box"} gestoken`,
                            "Netwerk bekabeld aangesloten indien mogelijk",
                            "Voeding aangesloten — wacht op eerste opstart",
                            "Pi heeft minimaal 2 minuten de tijd gekregen",
                          ].map((item) => (
                            <label
                              key={item}
                              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <input type="checkbox" className="mt-0.5" />
                              <span>{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Afronden */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Installatie afronden
                        </div>
                        <p className="text-sm leading-7 text-slate-600">
                          Deze stap forceert geen online-status. Echte claim,
                          heartbeat of online zie je alleen als de backend die
                          status heeft bevestigd.
                        </p>
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={onFinalizeProvisioning}
                            disabled={!canFinalizeProvisioning}
                            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Installatie afronden
                          </button>
                        </div>
                        <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                          Context: <strong>{normalizedBoxId || "—"}</strong>{" "}
                          voor <strong>{customerLabel}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900">
                      Het doel van deze stap is alleen de eerste opstart correct
                      laten gebeuren. De echte bevestiging komt via de
                      backendstatus.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════ STAP 5: Live controle ════ */}
            {selectedProvisioningStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Live controle
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    De installatie is geslaagd als de box hier als{" "}
                    <strong>online</strong> of <strong>ready</strong> verschijnt.
                    Je kan nu de box testen via het portal.
                  </p>
                </div>

                {!stepOneReady && !provisioningExists ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                    Maak eerst een installatievoorbereiding aan in stap 2.
                  </div>
                ) : (
                  <>
                    {/* Backendstatus */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Backendstatus
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Hier mag je alleen werken met backend- of
                            devicebevestigde status.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onRefreshProvisioning}
                          disabled={!canRefreshProvisioning}
                          className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Ververs status
                        </button>
                      </div>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Huidige status
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <StatusBadge status={provisioningItem?.status} />
                          <span className="text-sm text-slate-500">
                            {provisioningStatusLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      {/* Checklist */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Wat nu controleren
                        </div>
                        <div className="space-y-2.5 text-sm text-slate-700">
                          {[
                            `Box ${normalizedBoxId || "—"} heeft stroom`,
                            "Netwerk of bekabeling correct aangesloten",
                            "Geen signalen van verkeerde kaart of box",
                            `Opstart voor ${customerLabel} op ${trimmedSiteId || "—"}`,
                          ].map((item) => (
                            <label
                              key={item}
                              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <input type="checkbox" className="mt-0.5" />
                              <span>{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Backend bevestiging */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          Wat backend moet bevestigen
                        </div>
                        <div className="space-y-2.5 text-sm leading-7 text-slate-600">
                          {[
                            "Pi heeft zichzelf geclaimd met de juiste boxcontext",
                            "Eerste heartbeat of online-melding is binnen",
                            "Backend herkent deze installatie",
                          ].map((item) => (
                            <div
                              key={item}
                              className="rounded-xl bg-slate-50 px-4 py-3"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          Zonder backendbevestiging blijft de status
                          voorlopig.
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900">
                      Pas wanneer backend en device dit bevestigen, mag deze
                      installatie als klaar getoond worden.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════ STAP 6: Installatie voltooid ════ */}
            {selectedProvisioningStep === 6 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Installatie voltooid
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    De box is online en actief. De installatie is succesvol
                    afgerond.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
                  <div className="text-base font-bold text-emerald-800">
                    Installatie geslaagd
                  </div>
                  <p className="mt-2 text-sm leading-7 text-emerald-700">
                    Box <strong>{normalizedBoxId || "—"}</strong> is succesvol
                    geïnstalleerd voor <strong>{customerLabel}</strong> op site{" "}
                    <strong>{trimmedSiteId || "—"}</strong>.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 text-sm font-semibold text-slate-900">
                      Installatieoverzicht
                    </div>
                    <div className="space-y-2.5">
                      <KVRow
                        label="Box-ID"
                        value={provisioningItem?.boxId || normalizedBoxId || "—"}
                        mono
                      />
                      <KVRow label="Klant" value={customerLabel} />
                      <KVRow
                        label="Site"
                        value={trimmedSiteId || "—"}
                        mono
                      />
                      <KVRow
                        label="Status"
                        value={provisioningItem?.status || "—"}
                        mono
                      />
                      <KVRow
                        label="Provisioning ID"
                        value={provisioningIdLabel}
                        mono
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 text-sm font-semibold text-slate-900">
                      Tijdstempels
                    </div>
                    <div className="space-y-2.5">
                      <KVRow
                        label="Aangemaakt"
                        value={provisioningCreatedAt}
                      />
                      <KVRow label="Geclaimd" value={provisioningClaimedAt} />
                      <KVRow
                        label="Heartbeat"
                        value={provisioningLastHeartbeatAt}
                      />
                      <KVRow
                        label="Afgerond"
                        value={provisioningFinalizedAt}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onRefreshProvisioning}
                      disabled={!canRefreshProvisioning}
                      className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Ververs status
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
