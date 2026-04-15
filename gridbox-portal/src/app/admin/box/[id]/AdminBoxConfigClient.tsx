"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";
import type { AdminSiteItem, CustomerItem } from "@/components/admin/types";

// ── Types ──────────────────────────────────────────────────────────────────

type BoxCamera = {
  enabled?: boolean;
  mac?: string | null;
  ip?: string | null;
  username?: string | null;
  snapshotIntervalSeconds?: number | null;
  changeDetectionThreshold?: number | null;
  postCloseSnapshotDurationSeconds?: number | null;
};

type BoxLights = {
  onWhenOpen?: boolean;
  lightOffDelaySeconds?: number | null;
};

type BoxShutter = {
  closeDurationSeconds?: number | null;
  openDurationSeconds?: number | null;
};

type BoxHardware = {
  camera?: BoxCamera | null;
  lights?: BoxLights | null;
  shutter?: BoxShutter | null;
};

type BoxAutoClose = {
  enabled?: boolean;
  delaySeconds?: number | null;
};

type BoxDetail = {
  id: string;
  boxId: string;
  displayName?: string | null;
  siteId?: string | null;
  customerId?: string | null;
  updatedAt?: string | null;
  autoClose?: BoxAutoClose | null;
  hardware?: BoxHardware | null;
  gatewayIp?: string | null;
  gatewayMac?: string | null;
  scriptVersion?: string | null;
  lastProvisionedAt?: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function numField(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return val;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminBoxConfigClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const boxId = searchParams.get("id") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [sites, setSites] = useState<AdminSiteItem[]>([]);

  // Gedrag
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [autoCloseDelay, setAutoCloseDelay] = useState("");

  // Camera
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraIp, setCameraIp] = useState("");
  const [cameraUsername, setCameraUsername] = useState("");
  const [cameraPassword, setCameraPassword] = useState("");
  const [cameraSnapshotInterval, setCameraSnapshotInterval] = useState("");
  const [cameraChangeThreshold, setCameraChangeThreshold] = useState("");
  const [cameraPostCloseDuration, setCameraPostCloseDuration] = useState("");

  // Verlichting
  const [lightsOnWhenOpen, setLightsOnWhenOpen] = useState(false);
  const [lightsOffDelay, setLightsOffDelay] = useState("");

  // Sluiter
  const [shutterClose, setShutterClose] = useState("");
  const [shutterOpen, setShutterOpen] = useState("");

  // Beheer
  const [displayName, setDisplayName] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!boxId) {
      setLoading(false);
      return;
    }
    let active = true;
    const unsubscribe = auth.onAuthStateChanged(async () => {
      if (active) await loadData();
    });
    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setErrorMessage("Niet aangemeld");
        setLoading(false);
        return;
      }

      const [boxRes, customersRes, sitesRes] = await Promise.all([
        fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}`), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(apiUrl("/admin/customers"), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(apiUrl("/admin/sites"), {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!boxRes.ok) {
        const err = await boxRes.json().catch(() => ({}));
        setErrorMessage((err as { message?: string }).message || "Box niet gevonden");
        return;
      }

      const [boxData, customersData, sitesData] = await Promise.all([
        boxRes.json(),
        customersRes.ok ? customersRes.json() : { items: [] },
        sitesRes.ok ? sitesRes.json() : { items: [] }
      ]);

      const b: BoxDetail = boxData.item;
      setBox(b);
      setCustomers((customersData as { items?: CustomerItem[] }).items || []);
      setSites((sitesData as { items?: AdminSiteItem[] }).items || []);

      // Populate form
      setAutoCloseEnabled(b.autoClose?.enabled ?? false);
      setAutoCloseDelay(numField(b.autoClose?.delaySeconds));

      const cam = b.hardware?.camera;
      setCameraEnabled(cam?.enabled ?? false);
      setCameraIp(cam?.ip ?? "");
      setCameraUsername(cam?.username ?? "");
      setCameraPassword("");
      setCameraSnapshotInterval(numField(cam?.snapshotIntervalSeconds));
      setCameraChangeThreshold(numField(cam?.changeDetectionThreshold));
      setCameraPostCloseDuration(numField(cam?.postCloseSnapshotDurationSeconds));

      const lights = b.hardware?.lights;
      setLightsOnWhenOpen(lights?.onWhenOpen ?? false);
      setLightsOffDelay(numField(lights?.lightOffDelaySeconds));

      const shutter = b.hardware?.shutter;
      setShutterClose(numField(shutter?.closeDurationSeconds));
      setShutterOpen(numField(shutter?.openDurationSeconds));

      setDisplayName(b.displayName ?? "");
      setSelectedSiteId(b.siteId ?? "");
      setSelectedCustomerId(b.customerId ?? "");
    } catch (err) {
      console.error(err);
      setErrorMessage("Fout bij laden van boxgegevens");
    } finally {
      setLoading(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setErrorMessage("Niet aangemeld");
        return;
      }

      // Persist camera ip/username/password via existing camera endpoint if changed
      if (cameraIp && box?.hardware?.camera?.mac) {
        const camRes = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera`), {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mac: box.hardware.camera.mac,
            ip: cameraIp,
            username: cameraUsername,
            ...(cameraPassword ? { password: cameraPassword } : {})
          })
        });
        if (!camRes.ok) {
          const err = await camRes.json().catch(() => ({}));
          setErrorMessage((err as { message?: string }).message || "Fout bij opslaan camera");
          return;
        }
      }

      const configRes = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/config`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName,
          siteId: selectedSiteId,
          customerId: selectedCustomerId,
          autoClose: {
            enabled: autoCloseEnabled,
            delaySeconds: parseNum(autoCloseDelay)
          },
          hardware: {
            camera: {
              enabled: cameraEnabled,
              snapshotIntervalSeconds: parseNum(cameraSnapshotInterval),
              changeDetectionThreshold: parseNum(cameraChangeThreshold),
              postCloseSnapshotDurationSeconds: parseNum(cameraPostCloseDuration)
            },
            lights: {
              onWhenOpen: lightsOnWhenOpen,
              lightOffDelaySeconds: parseNum(lightsOffDelay)
            },
            shutter: {
              closeDurationSeconds: parseNum(shutterClose),
              openDurationSeconds: parseNum(shutterOpen)
            }
          }
        })
      });

      if (!configRes.ok) {
        const err = await configRes.json().catch(() => ({}));
        setErrorMessage((err as { message?: string }).message || "Fout bij opslaan configuratie");
        return;
      }

      setSuccessMessage("Configuratie opgeslagen");
      await loadData();
    } catch (err) {
      console.error(err);
      setErrorMessage("Onverwachte fout bij opslaan");
    } finally {
      setSaving(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        <div className="px-6 py-6 space-y-5">{children}</div>
      </div>
    );
  }

  function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-semibold text-slate-700 shrink-0 w-64">{label}</label>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-slate-900" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    );
  }

  function NumInput({
    value,
    onChange,
    placeholder
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
      />
    );
  }

  function TextInput({
    value,
    onChange,
    placeholder,
    disabled,
    type = "text"
  }: {
    value: string;
    onChange?: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
  }) {
    return (
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
      />
    );
  }

  function KVRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
      <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <span className="text-sm font-semibold text-slate-900 text-right">{value || "—"}</span>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Laden…</p>
      </div>
    );
  }

  const title = box?.displayName || box?.boxId || boxId;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/admin" className="hover:text-slate-900 transition">Admin</Link>
          <span>›</span>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="hover:text-slate-900 transition"
          >
            Boxen
          </button>
          <span>›</span>
          <span className="text-slate-900 font-semibold">{box?.boxId || boxId} configuratie</span>
        </nav>

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-slate-900">{title} — configuratie</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-slate-500">
            {box?.displayName && <span className="font-semibold text-slate-700">{box.displayName}</span>}
            {box?.displayName && box?.siteId && <span>·</span>}
            {box?.siteId && <span>{box.siteId}</span>}
            {box?.siteId && box?.customerId && <span>·</span>}
            {box?.customerId && <span>{box.customerId}</span>}
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span>status onbekend</span>
            </span>
          </div>
        </div>

        {/* Feedback */}
        {errorMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-800">
            {successMessage}
          </div>
        )}

        {/* A — GEDRAG */}
        <SectionCard title="Gedrag">
          <FieldRow label="Automatisch sluiten">
            <Toggle checked={autoCloseEnabled} onChange={setAutoCloseEnabled} />
          </FieldRow>
          {autoCloseEnabled && (
            <FieldRow label="Vertraging (seconden)">
              <NumInput value={autoCloseDelay} onChange={setAutoCloseDelay} placeholder="bijv. 30" />
            </FieldRow>
          )}
        </SectionCard>

        {/* B — HARDWARE */}
        <SectionCard title="Hardware">
          {/* Camera */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">Camera</p>
            <div className="space-y-4">
              <FieldRow label="Camera actief">
                <Toggle checked={cameraEnabled} onChange={setCameraEnabled} />
              </FieldRow>
              <FieldRow label="IP-adres">
                <TextInput value={cameraIp} onChange={setCameraIp} placeholder="192.168.10.x" />
              </FieldRow>
              <FieldRow label="Gebruikersnaam">
                <TextInput value={cameraUsername} onChange={setCameraUsername} placeholder="admin" />
              </FieldRow>
              <FieldRow label="Wachtwoord">
                <TextInput
                  type="password"
                  value={cameraPassword}
                  onChange={setCameraPassword}
                  placeholder="Laat leeg om ongewijzigd te laten"
                />
              </FieldRow>
              <FieldRow label="Snapshot interval (sec)">
                <NumInput value={cameraSnapshotInterval} onChange={setCameraSnapshotInterval} placeholder="bijv. 5" />
              </FieldRow>
              <FieldRow label="Bewegingsdrempel (0–1)">
                <NumInput value={cameraChangeThreshold} onChange={setCameraChangeThreshold} placeholder="bijv. 0.02" />
              </FieldRow>
              <FieldRow label="Snapshot duur na sluiten (sec)">
                <NumInput value={cameraPostCloseDuration} onChange={setCameraPostCloseDuration} placeholder="bijv. 10" />
              </FieldRow>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Verlichting */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">Verlichting</p>
            <div className="space-y-4">
              <FieldRow label="Aan bij open deur">
                <Toggle checked={lightsOnWhenOpen} onChange={setLightsOnWhenOpen} />
              </FieldRow>
              <FieldRow label="Vertraging uitschakelen (sec)">
                <NumInput value={lightsOffDelay} onChange={setLightsOffDelay} placeholder="bijv. 60" />
              </FieldRow>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Sluiter / motor */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">Sluiter / motor</p>
            <div className="space-y-4">
              <FieldRow label="Sluitduur (sec)">
                <NumInput value={shutterClose} onChange={setShutterClose} placeholder="bijv. 8" />
              </FieldRow>
              <FieldRow label="Openduur (sec)">
                <NumInput value={shutterOpen} onChange={setShutterOpen} placeholder="bijv. 8" />
              </FieldRow>
            </div>
          </div>
        </SectionCard>

        {/* C — NETWERK & INFO */}
        <SectionCard title="Netwerk & info">
          <KVRow label="Gateway IP" value={box?.gatewayIp} />
          <KVRow label="Gateway MAC" value={box?.gatewayMac} />
          <KVRow label="Software versie" value={box?.scriptVersion} />
          <KVRow label="Laatste heartbeat" value={formatDate(box?.lastProvisionedAt)} />
          <KVRow label="Laatste update" value={formatDate(box?.updatedAt)} />
        </SectionCard>

        {/* D — BEHEER */}
        <SectionCard title="Beheer">
          <FieldRow label="Weergavenaam">
            <TextInput value={displayName} onChange={setDisplayName} placeholder={box?.boxId || boxId} />
          </FieldRow>
          <FieldRow label="Site">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            >
              <option value="">— kies site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ? `${s.name} (${s.id})` : s.id}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Klant">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            >
              <option value="">— kies klant —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ? `${c.name} (${c.id})` : c.id}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Box ID">
            <TextInput value={box?.boxId || boxId} disabled />
          </FieldRow>
        </SectionCard>

        {/* Opslaan knop */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? "Opslaan…" : "Configuratie opslaan"}
          </button>
        </div>

        {/* E — GEVARENZONE */}
        <SectionCard title="Gevarenzone">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-amber-900">Box deactiveren</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  De box wordt gedeactiveerd en is niet meer bereikbaar voor gebruikers.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 transition shrink-0"
                onClick={() => setErrorMessage("Deactiveren is nog niet geïmplementeerd")}
              >
                Deactiveren
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-red-900">Box verwijderen</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Verwijdert de box definitief uit het platform. Dit kan niet ongedaan worden gemaakt.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 transition shrink-0"
                onClick={() => setErrorMessage("Verwijderen is nog niet geïmplementeerd")}
              >
                Verwijderen
              </button>
            </div>
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
