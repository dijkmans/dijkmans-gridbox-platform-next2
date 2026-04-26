"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";
import type { AdminSiteItem, CustomerItem } from "@/components/admin/types";

// ── Types ──────────────────────────────────────────────────────────────────

type CameraContext = {
  firestoreCamera: {
    ip: string | null;
    mac: string | null;
    snapshotUrl: string | null;
    updatedAt: string | null;
    enabled: boolean | null;
  } | null;
  detectedMac: string | null;
  detectedIp: string | null;
  routerStatus: "online" | "offline" | "unknown";
  leaseStatus: "active" | "not_set" | "conflict" | "unknown";
  lastError: string | null;
};

type BoxCamera = {
  config?: {
    enabled?: boolean | null;
    username?: string | null;
    snapshotIntervalSeconds?: number | null;
    changeDetectionThreshold?: number | null;
    postCloseSnapshotDurationSeconds?: number | null;
  } | null;
  assignment?: {
    mac?: string | null;
    ip?: string | null;
    snapshotUrl?: string | null;
    updatedAt?: string | null;
  } | null;
  observed?: {
    detectedMac?: string | null;
    detectedIp?: string | null;
    lastSeenAt?: string | null;
  } | null;
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
  lighting?: BoxLights | null;
  shutter?: BoxShutter | null;
  pi?: { mac?: string | null; ip?: string | null; serial?: string | null } | null;
  rut?: {
    config?: { ip?: string | null; username?: string | null; password?: string | null; model?: string | null } | null;
    observed?: { ip?: string | null; mac?: string | null; serial?: string | null; lastSeenAt?: string | null } | null;
  } | null;
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
  status?: string | null;
  autoClose?: BoxAutoClose | null;
  hardware?: BoxHardware | null;
  gatewayIp?: string | null;
  gatewayMac?: string | null;
  rutIp?: string | null;
  rutMac?: string | null;
  rutSerial?: string | null;
  piMac?: string | null;
  piIp?: string | null;
  scriptVersion?: string | null;
  lastProvisionedAt?: string | null;
  software?: {
    versionRaspberry?: string | null;
    targetVersion?: string | null;
    deploymentStatus?: string | null;
    updateStatus?: string | null;
    lastHeartbeatIso?: string | null;
  } | null;
  state?: {
    boxIsOpen?: boolean | null;
    lastActionSource?: string | null;
    lastActionAt?: string | null;
  } | null;
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

// ── Nav config ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Configuratie",
    items: [
      { id: "gedrag",     label: "Gedrag",           emoji: "⚙️" },
      { id: "camera",     label: "Camera",            emoji: "🎥" },
      { id: "rut",        label: "Router (RUT241)",   emoji: "🌐" },
      { id: "verlichting",label: "Verlichting",       emoji: "💡" },
      { id: "motor",      label: "Sluiter / motor",   emoji: "⚡" },
    ],
  },
  {
    label: "Info & Beheer",
    items: [
      { id: "netwerk", label: "Netwerk & info", emoji: "📡" },
      { id: "beheer",  label: "Beheer",         emoji: "🏷️" },
    ],
  },
  {
    label: "Systeem",
    items: [
      { id: "update", label: "Software update", emoji: "🔄" },
      { id: "gevaar", label: "Gevarenzone",     emoji: "⚠️" },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminBoxConfigClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const boxId = searchParams.get("id") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeSection, setActiveSection] = useState("gedrag");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [sites, setSites] = useState<AdminSiteItem[]>([]);

  // Gedrag
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [autoCloseDelay, setAutoCloseDelay] = useState("");

  // Camera
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraIp, setCameraIp] = useState("");
  const [cameraMac, setCameraMac] = useState<string | null>(null);
  const [cameraUsername, setCameraUsername] = useState("");
  const [cameraPassword, setCameraPassword] = useState("");
  const [cameraSnapshotInterval, setCameraSnapshotInterval] = useState("");
  const [cameraChangeThreshold, setCameraChangeThreshold] = useState("");
  const [cameraPostCloseDuration, setCameraPostCloseDuration] = useState("");

  // Camera-toewijzingsflow
  const [cameraContext, setCameraContext] = useState<CameraContext | null>(null);
  const [cameraContextBusy, setCameraContextBusy] = useState(false);
  const [suggestedIp, setSuggestedIp] = useState<string | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [cameraFlowError, setCameraFlowError] = useState("");
  const [cameraFlowSuccess, setCameraFlowSuccess] = useState("");

  // Geavanceerd (camera sectie)
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Handmatige override (fallback)
  const [manualMac, setManualMac] = useState("");
  const [manualIp, setManualIp] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");

  // Verlichting
  const [lightsOnWhenOpen, setLightsOnWhenOpen] = useState(false);
  const [lightsOffDelay, setLightsOffDelay] = useState("");

  // Sluiter
  const [shutterClose, setShutterClose] = useState("");
  const [shutterOpen, setShutterOpen] = useState("");

  // RUT router
  const [rutIp, setRutIp] = useState("");
  const [rutMac, setRutMac] = useState<string | null>(null);
  const [rutSerial, setRutSerial] = useState<string | null>(null);
  const [rutModel, setRutModel] = useState<string | null>(null);
  const [rutUsername, setRutUsername] = useState("");
  const [rutPassword, setRutPassword] = useState("");

  // Beheer
  const [displayName, setDisplayName] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!boxId) { setLoading(false); return; }
    let active = true;
    const unsubscribe = auth.onAuthStateChanged(async () => {
      if (active) await loadData();
    });
    return () => { active = false; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  // ── IntersectionObserver — actieve nav-sectie ─────────────────────────────

  useEffect(() => {
    if (loading) return;
    const allIds = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    const observers: IntersectionObserver[] = [];

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0, rootMargin: "-10% 0px -80% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => { observers.forEach((obs) => obs.disconnect()); };
  }, [loading]);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const token = await auth.currentUser?.getIdToken();
      if (!token) { setErrorMessage("Niet aangemeld"); setLoading(false); return; }

      const [boxRes, customersRes, sitesRes] = await Promise.all([
        fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/admin/customers"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/admin/sites"), { headers: { Authorization: `Bearer ${token}` } })
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
      const nextCustomers: CustomerItem[] = (customersData as { items?: CustomerItem[] }).items || [];
      const nextSites: AdminSiteItem[] = (sitesData as { items?: AdminSiteItem[] }).items || [];

      console.log("[BoxConfig] loaded box:", b.boxId, "hardware:", b.hardware, "autoClose:", b.autoClose);

      setBox(b);
      setCustomers(nextCustomers);
      setSites(nextSites);

      setAutoCloseEnabled(b.autoClose?.enabled ?? false);
      setAutoCloseDelay(numField(b.autoClose?.delaySeconds));

      const camConfig = b.hardware?.camera?.config;
      const camAssignment = b.hardware?.camera?.assignment;
      setCameraEnabled(camConfig?.enabled ?? false);
      setCameraIp(camAssignment?.ip ?? "");
      setCameraMac(camAssignment?.mac ?? null);
      setCameraUsername(camConfig?.username ?? "");
      setCameraPassword("");
      setCameraSnapshotInterval(numField(camConfig?.snapshotIntervalSeconds));
      setCameraChangeThreshold(numField(camConfig?.changeDetectionThreshold));
      setCameraPostCloseDuration(numField(camConfig?.postCloseSnapshotDurationSeconds));

      const lights = b.hardware?.lighting as BoxLights | null | undefined;
      setLightsOnWhenOpen(lights?.onWhenOpen ?? false);
      setLightsOffDelay(numField(lights?.lightOffDelaySeconds));

      const shutter = b.hardware?.shutter;
      setShutterClose(numField(shutter?.closeDurationSeconds));
      setShutterOpen(numField(shutter?.openDurationSeconds));

      const rutConfig = b.hardware?.rut?.config;
      const rutObserved = b.hardware?.rut?.observed;
      setRutIp(rutConfig?.ip ?? "");
      setRutModel(rutConfig?.model ?? null);
      setRutUsername(rutConfig?.username ?? "");
      setRutPassword("");
      setRutMac(rutObserved?.mac ?? null);
      setRutSerial(rutObserved?.serial ?? null);

      setDisplayName(b.displayName ?? "");

      const matchedCustomer = nextCustomers.find(
        (c) => c.id.toLowerCase() === (b.customerId ?? "").toLowerCase()
      );
      setSelectedCustomerId(matchedCustomer?.id ?? b.customerId ?? "");
      setSelectedSiteId(b.siteId ?? "");

      if (b.hardware?.camera?.assignment?.snapshotUrl) {
        loadCameraContext();
      }
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
      if (!token) { setErrorMessage("Niet aangemeld"); return; }

      const configRes = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/config`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName,
          siteId: selectedSiteId,
          customerId: selectedCustomerId,
          autoClose: { enabled: autoCloseEnabled, delaySeconds: parseNum(autoCloseDelay) },
          hardware: {
            rut: {
              config: {
                ip: rutIp,
                model: rutModel,
                username: rutUsername,
                ...(rutPassword ? { password: rutPassword } : {})
              }
            },
            camera: {
              config: {
                enabled: cameraEnabled,
                snapshotIntervalSeconds: parseNum(cameraSnapshotInterval),
                changeDetectionThreshold: parseNum(cameraChangeThreshold),
                postCloseSnapshotDurationSeconds: parseNum(cameraPostCloseDuration),
                username: cameraUsername,
                ...(cameraPassword ? { password: cameraPassword } : {})
              }
            },
            lighting: { onWhenOpen: lightsOnWhenOpen, lightOffDelaySeconds: parseNum(lightsOffDelay) },
            shutter: { closeDurationSeconds: parseNum(shutterClose), openDurationSeconds: parseNum(shutterOpen) }
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

  // ── Camera-toewijzingsflow ────────────────────────────────────────────────

  async function loadCameraContext() {
    const token = await auth.currentUser?.getIdToken();
    if (!token || !boxId) return;
    setCameraContextBusy(true);
    setCameraFlowError("");
    try {
      const res = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera-context`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { setCameraFlowError(data.message || "Camera-context ophalen mislukt"); return; }
      setCameraContext(data as CameraContext);
    } catch {
      setCameraFlowError("Netwerkfout bij ophalen camera-context");
    } finally {
      setCameraContextBusy(false);
    }
  }

  async function handleSuggestIp() {
    const token = await auth.currentUser?.getIdToken();
    if (!token || !boxId) return;
    setSuggestBusy(true);
    setCameraFlowError("");
    setSuggestedIp(null);
    try {
      const res = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera-suggest-ip`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json() as { suggestedIp?: string; message?: string };
      if (!res.ok) { setCameraFlowError(data.message || "Vrij IP bepalen mislukt"); return; }
      setSuggestedIp(data.suggestedIp ?? null);
    } catch {
      setCameraFlowError("Netwerkfout bij bepalen vrij IP");
    } finally {
      setSuggestBusy(false);
    }
  }

  async function handleCameraAssign() {
    const token = await auth.currentUser?.getIdToken();
    if (!token || !boxId) return;
    const mac = cameraContext?.detectedMac;
    if (!mac || !suggestedIp) return;

    setAssignBusy(true);
    setCameraFlowError("");
    setCameraFlowSuccess("");
    try {
      const res = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera-assign`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mac,
          chosenIp: suggestedIp,
          ...(cameraUsername ? { username: cameraUsername } : {}),
          ...(cameraPassword ? { password: cameraPassword } : {})
        })
      });
      const data = await res.json() as { ok?: boolean; ip?: string; mac?: string; message?: string };
      if (!res.ok) { setCameraFlowError(data.message || "Toewijzen camera mislukt"); return; }
      setCameraFlowSuccess(`Camera gekoppeld: MAC ${data.mac} → vast IP ${data.ip}`);
      await loadCameraContext();
      await loadData();
    } catch {
      setCameraFlowError("Netwerkfout bij toewijzen camera");
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleTestSnapshot() {
    setCameraFlowError("");
    setCameraFlowSuccess("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera/snapshot`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json() as { ok?: boolean; snapshotUrl?: string; message?: string };
      if (!res.ok) { setCameraFlowError(data.message || "Snapshot ophalen mislukt"); return; }
      if (data.snapshotUrl) {
        window.open(data.snapshotUrl, "_blank");
        setCameraFlowSuccess("Snapshot succesvol opgehaald — geopend in nieuw tabblad");
      }
    } catch {
      setCameraFlowError("Netwerkfout bij ophalen snapshot");
    }
  }

  async function handleManualAssign() {
    setManualError("");
    setManualSuccess("");

    const macTrimmed = manualMac.trim().toLowerCase();
    const ipTrimmed = manualIp.trim();

    if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(macTrimmed)) {
      setManualError("Ongeldig MAC-adres — gebruik het formaat xx:xx:xx:xx:xx:xx");
      return;
    }
    const ipMatch = ipTrimmed.match(/^192\.168\.10\.(\d+)$/);
    if (!ipMatch || parseInt(ipMatch[1], 10) < 100 || parseInt(ipMatch[1], 10) > 249) {
      setManualError("Ongeldig IP-adres — gebruik 192.168.10.x (100–249)");
      return;
    }

    try {
      setManualBusy(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setManualError("Niet aangemeld"); return; }

      const res = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mac: macTrimmed, ip: ipTrimmed })
      });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok) { setManualError(data.message || "Opslaan mislukt"); return; }

      setManualSuccess(`Camera handmatig opgeslagen: MAC ${macTrimmed} → IP ${ipTrimmed}. Vergeet niet de static lease ook in de RUT241 in te stellen.`);
      setManualMac("");
      setManualIp("");
      await loadData();
    } catch {
      setManualError("Netwerkfout bij handmatig opslaan");
    } finally {
      setManualBusy(false);
    }
  }

  // ── Software update ───────────────────────────────────────────────────────

  async function handleTriggerUpdate() {
    try {
      setUpdateBusy(true);
      setUpdateMessage("");
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setUpdateMessage("Niet aangemeld"); return; }
      const res = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/software/update`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUpdateMessage((data as { message?: string }).message || "Update starten mislukt");
        return;
      }
      setUpdateMessage("Update gestart — Pi herstart binnen enkele seconden");
      await loadData();
    } catch {
      setUpdateMessage("Netwerkfout bij starten update");
    } finally {
      setUpdateBusy(false);
    }
  }

  // ── Nav ───────────────────────────────────────────────────────────────────

  function scrollToSection(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function SectionCard({ id, title, subtitle, badge, children }: {
    id?: string;
    title: string;
    subtitle?: string;
    badge?: ReactNode;
    children: ReactNode;
  }) {
    return (
      <div id={id} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden scroll-mt-6">
        <div className="px-6 py-6 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
            </div>
            {badge && <div className="flex-shrink-0 pt-0.5">{badge}</div>}
          </div>
        </div>
        <div className="px-6 py-6 space-y-4">{children}</div>
      </div>
    );
  }

  function FieldRow({ label, children }: { label: string; children: ReactNode }) {
    return (
      <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
        <label className="text-sm font-semibold text-slate-600 shrink-0 w-56">{label}</label>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-slate-900" : "bg-slate-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    );
  }

  function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
      />
    );
  }

  function TextInput({ value, onChange, placeholder, disabled, type = "text" }: {
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
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
      />
    );
  }

  function KVRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
    return (
      <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <span className={`text-sm font-semibold text-slate-900 text-right ${mono ? "font-mono text-xs" : ""}`}>
          {value || "—"}
        </span>
      </div>
    );
  }

  function SubLabel({ children }: { children: ReactNode }) {
    return (
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 pt-3 pb-1 first:pt-0">
        {children}
      </p>
    );
  }

  function Pill({ color, children }: { color: "green" | "red" | "amber" | "gray"; children: ReactNode }) {
    const cls = {
      green: "bg-emerald-100 text-emerald-800 border-emerald-200",
      red:   "bg-red-100 text-red-800 border-red-200",
      amber: "bg-amber-100 text-amber-800 border-amber-200",
      gray:  "bg-slate-100 text-slate-600 border-slate-200",
    }[color];
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
        {children}
      </span>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isOnline       = box?.status === "online";
  const piVersion      = box?.software?.versionRaspberry ?? box?.scriptVersion ?? "—";
  const targetVersion  = box?.software?.targetVersion ?? "—";
  const deployStatus   = box?.software?.deploymentStatus;
  const lastHeartbeat  = box?.software?.lastHeartbeatIso ?? box?.updatedAt;
  const boxIsOpen      = box?.state?.boxIsOpen;
  const lastActionSrc  = box?.state?.lastActionSource;
  const versionOk      = deployStatus === "ON_TARGET" || (piVersion !== "—" && piVersion === targetVersion);

  const rutColor: "green" | "red" | "gray" =
    cameraContext?.routerStatus === "online" ? "green" :
    cameraContext?.routerStatus === "offline" ? "red" : "gray";

  const camColor: "green" | "amber" | "gray" =
    cameraContext?.routerStatus === "online" && !!cameraContext?.firestoreCamera ? "green" :
    cameraContext?.routerStatus === "offline" ? "amber" : "gray";

  const camText =
    camColor === "green"  ? "Online" :
    camColor === "amber"  ? "⚠ Offline" : "—";

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Laden…</p>
      </div>
    );
  }

  const boxTitle = box?.displayName || box?.boxId || boxId;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 bg-slate-900 text-slate-100 sticky top-0 h-screen overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="border-b border-slate-800 p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-1.5">
            Gridbox Platform
          </p>
          <p className="text-2xl font-bold text-slate-100 mb-1">
            {(box?.boxId ?? boxId).toUpperCase()}
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            {box?.displayName ?? "—"}
            {box?.siteId && <><br />{box.siteId}</>}
          </p>
          <span className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
            isOnline
              ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
              : "bg-slate-700 border border-slate-600 text-slate-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`} />
            {isOnline ? "Online" : box?.status ?? "Onbekend"}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold px-3 pb-1">
                {group.label}
              </p>
              {group.items.map(({ id, label, emoji }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors text-left ${
                    activeSection === id
                      ? "bg-white text-slate-900 font-semibold"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-700 text-[13px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            ↗&nbsp; Operations Center
          </Link>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 py-10 px-12">
        <div className="max-w-3xl space-y-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/admin" className="hover:text-slate-900 transition">Admin</Link>
            <span>›</span>
            <button type="button" onClick={() => router.push("/admin")} className="hover:text-slate-900 transition">
              Boxen
            </button>
            <span>›</span>
            <span className="text-slate-900 font-semibold">{box?.boxId ?? boxId} configuratie</span>
          </nav>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-bold text-slate-900 leading-tight">{boxTitle} — configuratie</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500 flex-wrap">
              {box?.displayName && <span className="font-semibold text-slate-700">{box.displayName}</span>}
              {box?.displayName && box?.siteId && <span className="text-slate-300">·</span>}
              {box?.siteId && <span>{box.siteId}</span>}
              {box?.updatedAt && <span className="text-slate-300">·</span>}
              {box?.updatedAt && <span>Bijgewerkt {formatDate(box.updatedAt)}</span>}
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className={isOnline ? "text-emerald-600 font-semibold" : ""}>{isOnline ? "Online" : "Offline"}</span>
              </span>
            </div>
          </div>

          {/* Status pills */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-3xl px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">Positie</p>
              <p className="text-sm font-bold text-slate-900">
                {boxIsOpen === true ? "Open" : boxIsOpen === false ? "Dicht" : "—"}
              </p>
              {lastActionSrc && <p className="text-[11px] text-slate-400 mt-0.5">{lastActionSrc}</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">Versie Pi</p>
              <p className={`text-sm font-bold ${versionOk ? "text-slate-900" : "text-amber-600"}`}>{piVersion}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {versionOk ? "up to date" : `target: ${targetVersion}`}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">Heartbeat</p>
              <p className="text-xs font-bold text-slate-900 leading-snug">{formatDate(lastHeartbeat)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">Camera</p>
              <p className={`text-sm font-bold ${
                camColor === "green" ? "text-emerald-600" :
                camColor === "amber" ? "text-amber-600" : "text-slate-900"
              }`}>{camText}</p>
              {camColor === "amber" && <p className="text-[11px] text-slate-400 mt-0.5">RUT offline</p>}
            </div>
          </div>

          {/* Feedback */}
          {errorMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-relaxed text-amber-900">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm leading-relaxed text-emerald-800">
              {successMessage}
            </div>
          )}

          {/* ── A: GEDRAG ─────────────────────────────────────────────── */}
          <SectionCard id="gedrag" title="Gedrag" subtitle="Automatisch sluiten en tijdsinstellingen voor de box">
            <FieldRow label="Automatisch sluiten">
              <Toggle checked={autoCloseEnabled} onChange={setAutoCloseEnabled} />
            </FieldRow>
            {autoCloseEnabled && (
              <FieldRow label="Vertraging (seconden)">
                <NumInput value={autoCloseDelay} onChange={setAutoCloseDelay} placeholder="bijv. 300" />
              </FieldRow>
            )}
          </SectionCard>

          {/* ── B: CAMERA ────────────────────────────────────────────── */}
          <SectionCard
            id="camera"
            title="Camera"
            subtitle="Stapsgewijze koppeling en configuratie van de netwerkcamera"
            badge={
              cameraContext ? (
                <Pill color={camColor === "amber" ? "amber" : camColor === "green" ? "green" : "gray"}>
                  {camColor === "amber" ? "⚠ RUT offline" : camColor === "green" ? "✓ Online" : "Onbekend"}
                </Pill>
              ) : undefined
            }
          >
            {cameraFlowError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{cameraFlowError}</div>
            )}
            {cameraFlowSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{cameraFlowSuccess}</div>
            )}
            {cameraContext?.routerStatus === "offline" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                ⚠ RUT241 router is niet bereikbaar — camera-koppeling tijdelijk niet mogelijk.
              </div>
            )}

            {/* ── STAP 1 — Camera detecteren ──────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                <p className="text-sm font-bold text-slate-900">Camera detecteren</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                {cameraContext === null ? (
                  <p className="text-sm text-slate-400">Nog niet opgeroepen</p>
                ) : cameraContext.detectedMac ? (
                  <>
                    <KVRow label="Netwerk-IP" value={cameraContext.detectedIp} mono />
                    <KVRow label="MAC-adres" value={cameraContext.detectedMac} mono />
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Geen camera gedetecteerd op het netwerk</p>
                )}
              </div>
              <button type="button" onClick={loadCameraContext} disabled={cameraContextBusy}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition">
                {cameraContextBusy ? "Bezig…" : "🔍 Zoek camera opnieuw"}
              </button>
            </div>

            <hr className="border-slate-100" />

            {/* ── STAP 2 — Camera instellen en koppelen ───────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                <p className="text-sm font-bold text-slate-900">Camera instellen en koppelen</p>
              </div>
              <FieldRow label="Gebruikersnaam">
                <TextInput value={cameraUsername} onChange={setCameraUsername} placeholder="admin" />
              </FieldRow>
              <FieldRow label="Wachtwoord">
                <TextInput type="password" value={cameraPassword} onChange={setCameraPassword} placeholder="Laat leeg om ongewijzigd te laten" />
              </FieldRow>
              <div className="flex flex-wrap gap-2 items-center pt-1">
                <button type="button" onClick={handleSuggestIp} disabled={suggestBusy}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition">
                  {suggestBusy ? "Bezig…" : suggestedIp ? `💡 IP: ${suggestedIp} ↺` : "💡 Stel vrij IP voor"}
                </button>
                <button type="button" onClick={handleCameraAssign}
                  disabled={assignBusy || !cameraContext?.detectedMac || !suggestedIp}
                  title={!cameraContext?.detectedMac ? "Detecteer eerst een camera (stap 1)" : !suggestedIp ? "Stel eerst een vrij IP voor" : ""}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-40 transition">
                  {assignBusy ? "Bezig…" : "✅ Bevestig en zet vast IP op router"}
                </button>
                <button type="button" onClick={handleTestSnapshot}
                  disabled={!cameraContext?.firestoreCamera?.snapshotUrl}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition">
                  📸 Test snapshot
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* ── STAP 3 — Huidige status ──────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                <p className="text-sm font-bold text-slate-900">Huidige status</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                {cameraContext?.firestoreCamera ? (
                  <>
                    <KVRow label="MAC-adres" value={cameraContext.firestoreCamera.mac} mono />
                    <KVRow label="Vast IP op router" value={cameraContext.firestoreCamera.ip} mono />
                    <KVRow label="Snapshot URL" value={cameraContext.firestoreCamera.snapshotUrl} mono />
                    <KVRow label="Laatste update" value={formatDate(cameraContext.firestoreCamera.updatedAt)} />
                    <div className="pt-1">
                      <Pill color={cameraContext.leaseStatus === "active" ? "green" : cameraContext.leaseStatus === "conflict" ? "red" : "gray"}>
                        {cameraContext.leaseStatus === "active" ? "Lease actief" :
                         cameraContext.leaseStatus === "not_set" ? "Lease niet gezet" :
                         cameraContext.leaseStatus === "conflict" ? "Lease conflict" : "Lease onbekend"}
                      </Pill>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Nog geen camera gekoppeld aan deze box</p>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* ── STAP 4 — Geavanceerd (collapsible) ──────────────────── */}
            <div>
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
              >
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                Geavanceerd
                <span className="text-slate-400 text-xs ml-1">{advancedOpen ? "▲ inklappen" : "▼ uitklappen"}</span>
              </button>
              {advancedOpen && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Handmatige override</p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Gebruik dit als de Pi of RUT241 niet bereikbaar is. Stel de static lease daarna ook zelf in op de RUT241 (Network → DHCP → Static Leases).
                    </p>
                    {manualError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{manualError}</div>
                    )}
                    {manualSuccess && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{manualSuccess}</div>
                    )}
                    <FieldRow label="MAC-adres camera">
                      <TextInput value={manualMac} onChange={setManualMac} placeholder="bijv. 08:8f:c3:f0:a5:6a" />
                    </FieldRow>
                    <FieldRow label="Vast IP-adres">
                      <TextInput value={manualIp} onChange={setManualIp} placeholder="bijv. 192.168.10.100" />
                    </FieldRow>
                    <button type="button" onClick={handleManualAssign}
                      disabled={manualBusy || !manualMac || !manualIp}
                      className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-40 transition">
                      {manualBusy ? "Bezig…" : "⚠ Handmatig opslaan in Firestore (zonder Pi)"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Camera-instellingen</p>
                    <FieldRow label="Camera actief">
                      <Toggle checked={cameraEnabled} onChange={setCameraEnabled} />
                    </FieldRow>
                    <FieldRow label="Snapshot interval (sec)">
                      <NumInput value={cameraSnapshotInterval} onChange={setCameraSnapshotInterval} placeholder="bijv. 5" />
                    </FieldRow>
                    <FieldRow label="Bewegingsdrempel">
                      <NumInput value={cameraChangeThreshold} onChange={setCameraChangeThreshold} placeholder="bijv. 6.0" />
                    </FieldRow>
                    <FieldRow label="Snapshot duur na sluiten (sec)">
                      <NumInput value={cameraPostCloseDuration} onChange={setCameraPostCloseDuration} placeholder="bijv. 30" />
                    </FieldRow>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* ── STAP 5 — Router (RUT241) ─────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">5</span>
                <p className="text-sm font-bold text-slate-900">Router (RUT241)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill color={rutColor}>
                  <span className={`h-1.5 w-1.5 rounded-full inline-block ${
                    rutColor === "green" ? "bg-emerald-500" : rutColor === "red" ? "bg-red-500" : "bg-slate-400"
                  }`} />
                  {cameraContext?.routerStatus === "online" ? "Router online" :
                   cameraContext?.routerStatus === "offline" ? "Router offline" : "Status onbekend"}
                </Pill>
              </div>
              <KVRow label="RUT IP" value={box?.rutIp ?? box?.hardware?.rut?.config?.ip ?? box?.gatewayIp} mono />
              <KVRow label="RUT MAC" value={box?.rutMac ?? box?.hardware?.rut?.observed?.mac} mono />
              {cameraContext?.lastError && (
                <p className="text-xs text-amber-700">{cameraContext.lastError}</p>
              )}
            </div>

          </SectionCard>

          {/* ── C: ROUTER RUT241 ─────────────────────────────────────── */}
          <SectionCard
            id="rut"
            title="Router (RUT241)"
            subtitle="Verbindingsinstellingen voor de RUT241 mobiele router"
            badge={
              cameraContext ? (
                <Pill color={rutColor}>
                  <span className={`h-1.5 w-1.5 rounded-full inline-block ${
                    rutColor === "green" ? "bg-emerald-500" : rutColor === "red" ? "bg-red-500" : "bg-slate-400"
                  }`} />
                  {cameraContext.routerStatus === "online" ? "Online" :
                   cameraContext.routerStatus === "offline" ? "Offline" : "Onbekend"}
                </Pill>
              ) : undefined
            }
          >
            <SubLabel>Configuratie</SubLabel>
            <FieldRow label="IP-adres RUT">
              <div className="flex items-center gap-2">
                <TextInput value={rutIp || "—"} disabled />
                <span className="text-xs text-slate-400 shrink-0">automatisch</span>
              </div>
            </FieldRow>
            <FieldRow label="Model">
              <TextInput value={rutModel ?? ""} onChange={(v) => setRutModel(v || null)} placeholder="RUT241" />
            </FieldRow>
            <FieldRow label="Gebruikersnaam">
              <div className="flex items-center gap-2">
                <TextInput value={rutUsername || "root"} disabled />
                <span className="text-xs text-slate-400 shrink-0">automatisch</span>
              </div>
            </FieldRow>
            <FieldRow label="Wachtwoord">
              <TextInput type="password" value={rutPassword} onChange={setRutPassword} placeholder="Laat leeg om ongewijzigd te laten" />
            </FieldRow>

            <SubLabel>Gedetecteerde gegevens (read-only)</SubLabel>
            <KVRow label="Gedetecteerde MAC" value={rutMac} mono />
            <KVRow label="Gedetecteerd serienummer" value={rutSerial} mono />
            <KVRow label="Laatste heartbeat RUT" value={formatDate(box?.hardware?.rut?.observed?.lastSeenAt)} />
          </SectionCard>

          {/* ── D: VERLICHTING ───────────────────────────────────────── */}
          <SectionCard id="verlichting" title="Verlichting" subtitle="Gedrag van de verlichting gekoppeld aan de boxstatus">
            <FieldRow label="Aan bij open deur">
              <Toggle checked={lightsOnWhenOpen} onChange={setLightsOnWhenOpen} />
            </FieldRow>
            <FieldRow label="Vertraging uitschakelen (sec)">
              <NumInput value={lightsOffDelay} onChange={setLightsOffDelay} placeholder="bijv. 60" />
            </FieldRow>
          </SectionCard>

          {/* ── E: SLUITER / MOTOR ───────────────────────────────────── */}
          <SectionCard id="motor" title="Sluiter / motor" subtitle="Duur van de motorbeweging voor openen en sluiten">
            <FieldRow label="Sluitduur motor (sec)">
              <NumInput value={shutterClose} onChange={setShutterClose} placeholder="bijv. 30" />
            </FieldRow>
            <FieldRow label="Openduur motor (sec)">
              <NumInput value={shutterOpen} onChange={setShutterOpen} placeholder="bijv. 30" />
            </FieldRow>
          </SectionCard>

          {/* ── F: NETWERK & INFO ────────────────────────────────────── */}
          <SectionCard id="netwerk" title="Netwerk & info" subtitle="Systeeminformatie van de Raspberry Pi en het lokale netwerk">
            <SubLabel>Raspberry Pi</SubLabel>
            <KVRow label="IP Pi (lokaal)" value={box?.piIp ?? box?.hardware?.pi?.ip} mono />
            <KVRow label="MAC Pi" value={box?.piMac ?? box?.hardware?.pi?.mac} mono />
            <KVRow label="Software versie Pi" value={box?.software?.versionRaspberry ?? box?.scriptVersion} />
            <KVRow label="Laatste heartbeat Pi" value={formatDate(lastHeartbeat)} />
            <KVRow label="Laatste update config" value={formatDate(box?.updatedAt)} />

            <SubLabel>Gateway / netwerk</SubLabel>
            <KVRow label="RUT IP (config)" value={box?.rutIp ?? box?.gatewayIp} mono />
            <KVRow label="RUT MAC (gedetecteerd)" value={box?.rutMac ?? box?.gatewayMac} mono />
            <KVRow label="RUT serienummer" value={box?.rutSerial} mono />
          </SectionCard>

          {/* ── G: BEHEER ────────────────────────────────────────────── */}
          <SectionCard id="beheer" title="Beheer" subtitle="Naam, site-koppeling en klanttoewijzing">
            <FieldRow label="Weergavenaam">
              <TextInput value={displayName} onChange={setDisplayName} placeholder={box?.boxId || boxId} />
            </FieldRow>
            <FieldRow label="Site">
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">— kies site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name ? `${s.name} (${s.id})` : s.id}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Klant">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">— kies klant —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name ? `${c.name} (${c.id})` : c.id}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Box ID">
              <TextInput value={box?.boxId || boxId} disabled />
            </FieldRow>
          </SectionCard>

          {/* Opslaan */}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.push("/admin")}
              className="rounded-xl border border-slate-300 bg-white text-slate-700 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
              Annuleren
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="rounded-xl bg-slate-900 text-white px-6 py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {saving ? "Opslaan…" : "Configuratie opslaan"}
            </button>
          </div>

          {/* ── H: SOFTWARE UPDATE ───────────────────────────────────── */}
          <SectionCard
            id="update"
            title="Software update"
            subtitle="Gecontroleerd uitrollen van nieuwe firmware naar de Pi"
            badge={
              versionOk
                ? <Pill color="green">✓ Up to date</Pill>
                : piVersion !== "—" && targetVersion !== "—"
                  ? <Pill color="amber">Update beschikbaar</Pill>
                  : undefined
            }
          >
            {/* Versievergelijking */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">Huidige versie (Pi)</p>
                <p className="text-xl font-bold text-slate-900">{piVersion}</p>
              </div>
              <div className="text-center text-xl text-slate-300">→</div>
              <div className={`border rounded-2xl p-4 text-center ${versionOk ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">Doelversie (GitHub)</p>
                <p className={`text-xl font-bold ${versionOk ? "text-emerald-600" : "text-slate-900"}`}>{targetVersion}</p>
              </div>
            </div>

            {/* Stappen */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">Update procedure</p>
              {[
                "Laatste versie ophalen via GitHub (tags)",
                "git checkout naar doelversie op de Pi",
                "pip install -r requirements.txt uitvoeren",
                "systemctl restart gridbox.service",
                "Bevestigen dat service actief is",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 text-sm text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              ℹ De Pi blijft bereikbaar tijdens de update. De service is ongeveer 5 seconden offline tijdens herstart.
            </div>

            {/* Update feedback */}
            {updateMessage && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                updateMessage.includes("gestart")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {updateMessage}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleTriggerUpdate} disabled={updateBusy}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-black disabled:opacity-40 transition">
                {updateBusy ? "⏳ Bezig…" : "🔄 Update uitvoeren"}
              </button>
            </div>
          </SectionCard>

          {/* ── I: GEVARENZONE ───────────────────────────────────────── */}
          <SectionCard id="gevaar" title="Gevarenzone" subtitle="Onomkeerbare acties — wees zeker voor je verder gaat">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Box deactiveren</p>
                  <p className="text-xs text-amber-700 mt-0.5">De box wordt gedeactiveerd en is niet meer bereikbaar voor gebruikers.</p>
                </div>
                <button type="button"
                  className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 transition shrink-0"
                  onClick={() => setErrorMessage("Deactiveren is nog niet geïmplementeerd")}>
                  Deactiveren
                </button>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-red-900">Box verwijderen</p>
                  <p className="text-xs text-red-700 mt-0.5">Verwijdert de box definitief uit het platform. Dit kan niet ongedaan worden gemaakt.</p>
                </div>
                <button type="button"
                  className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 transition shrink-0"
                  onClick={() => setErrorMessage("Verwijderen is nog niet geïmplementeerd")}>
                  Verwijderen
                </button>
              </div>
            </div>
          </SectionCard>

        </div>
      </main>
    </div>
  );
}
