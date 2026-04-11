"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import AuthPanel from "@/components/AuthPanel";
import { apiUrl } from "@/lib/api";

type RmsSummary = {
  rmsStatus: "online" | "offline" | null;
  connectionState: string | null;
  connectionType: string | null;
  operator: string | null;
  signal: number | null;
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  temperature: number | null;
  routerUptime: number | null;
  wanIp: string | null;
  mobileIp: string | null;
  firmware: string | null;
  creditExpireDate: string | null;
  lastConnectionAt: string | null;
  iccid: string | null;
  imei: string | null;
};

type OperationsBoxItem = {
  id: string;
  boxId?: string;
  customerId?: string | null;
  siteId?: string | null;
  status?: string | null;
  lastHeartbeatAt?: string | { _seconds: number; _nanoseconds: number } | null;
  rmsDeviceId?: number | null;
  rms: RmsSummary | null;
  versionRaspberry?: string | null;
  targetVersion?: string | null;
  latestGithub?: string | null;
};

type CameraRecord = {
  id: string;
  ip: string;
  snapshotUrl: string;
  macAddress?: string | null;
  label?: string | null;
  model?: string | null;
  createdAt?: string | null;
};

type BoxCameraState = {
  isOpen: boolean;
  loaded: boolean;
  cameras: CameraRecord[];
  suggestedIp: string | null;
  loading: boolean;
  error: string;
  addOpen: boolean;
  addMac: string;
  addLabel: string;
  addBusy: boolean;
  addError: string;
  deletingId: string | null;
};

function formatDate(value?: string | null | { _seconds: number; _nanoseconds: number }) {
  if (!value) return "-";
  if (typeof value === "object" && "_seconds" in value) {
    return new Date(value._seconds * 1000).toLocaleString("nl-BE");
  }
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("nl-BE");
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}u`;
  if (hours > 0) return `${hours}u ${mins}m`;
  return `${mins}m`;
}

function isPiOnline(lastHeartbeatAt?: string | null | { _seconds: number; _nanoseconds: number }): boolean {
  if (!lastHeartbeatAt) return false;
  let ts: number;
  if (typeof lastHeartbeatAt === "object" && "_seconds" in lastHeartbeatAt) {
    ts = lastHeartbeatAt._seconds * 1000;
  } else {
    ts = new Date(lastHeartbeatAt as string).getTime();
  }
  return Date.now() - ts < 5 * 60 * 1000;
}

function isCreditExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr).getTime();
  return expiry - Date.now() < 30 * 24 * 60 * 60 * 1000;
}

const DEFAULT_CAM_STATE: BoxCameraState = {
  isOpen: false,
  loaded: false,
  cameras: [],
  suggestedIp: null,
  loading: false,
  error: "",
  addOpen: false,
  addMac: "",
  addLabel: "",
  addBusy: false,
  addError: "",
  deletingId: null,
};

export default function OperationsPage() {
  const [boxes, setBoxes] = useState<OperationsBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [cameraState, setCameraState] = useState<Record<string, BoxCameraState>>({});
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [triggerBusy, setTriggerBusy] = useState<Record<string, boolean>>({});
  const [triggerAllBusy, setTriggerAllBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  function patchCam(boxId: string, patch: Partial<BoxCameraState>) {
    setCameraState((prev) => ({
      ...prev,
      [boxId]: { ...(prev[boxId] ?? DEFAULT_CAM_STATE), ...patch },
    }));
  }

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("Meld je aan om operationsgegevens te bekijken");
        return;
      }

      const token = await user.getIdToken();
      const [res, swRes] = await Promise.all([
        fetch(apiUrl("/operations/boxes"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/operations/software/latest"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Kon data niet ophalen");
        return;
      }

      setBoxes(data.items || []);
      console.log("[loadData] boxes response:", (data.items || []).map((b: OperationsBoxItem) => ({
        id: b.id, versionRaspberry: b.versionRaspberry, targetVersion: b.targetVersion
      })));

      if (swRes.ok) {
        const swData = await swRes.json();
        setLatestVersion(swData.latestVersion ?? null);
      }
    } catch {
      setErrorMessage("Netwerkfout bij ophalen operationsdata");
    } finally {
      setLoading(false);
    }
  }

  const loadCameras = useCallback(async (boxId: string) => {
    patchCam(boxId, { loading: true, error: "" });
    try {
      const user = auth.currentUser;
      if (!user) {
        // Bug-fix: reset loading when user is missing, otherwise spinner hangs forever
        patchCam(boxId, { loading: false, error: "Niet aangemeld — ververs de pagina" });
        console.error("[loadCameras] auth.currentUser is null voor box", boxId);
        return;
      }
      const token = await user.getIdToken();
      console.log("[loadCameras] GET cameras voor box", boxId);
      const res = await fetch(apiUrl(`/operations/boxes/${encodeURIComponent(boxId)}/cameras`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[loadCameras] API fout", res.status, data);
        patchCam(boxId, { loading: false, error: data.message || "Kon camera's niet ophalen" });
        return;
      }
      console.log("[loadCameras] Ontvangen", data.count, "camera's voor box", boxId);
      patchCam(boxId, {
        loading: false,
        loaded: true,
        cameras: data.cameras ?? [],
        suggestedIp: data.suggestedIp ?? null,
      });
    } catch (err) {
      console.error("[loadCameras] Uitzondering voor box", boxId, err);
      patchCam(boxId, { loading: false, error: "Netwerkfout bij ophalen camera's" });
    }
  }, []);

  function toggleCameraSection(boxId: string) {
    const current = cameraState[boxId] ?? DEFAULT_CAM_STATE;
    if (current.isOpen) {
      // Inklapbaar
      patchCam(boxId, { isOpen: false });
      return;
    }
    // Openklappen
    patchCam(boxId, { isOpen: true });
    // Laad alleen als nog niet geladen en niet bezig
    if (!current.loaded && !current.loading) {
      loadCameras(boxId);
    }
  }

  async function handleAddCamera(boxId: string) {
    const cam = cameraState[boxId] ?? DEFAULT_CAM_STATE;
    if (!cam.addMac.trim()) {
      patchCam(boxId, { addError: "MAC-adres is verplicht" });
      return;
    }
    patchCam(boxId, { addBusy: true, addError: "" });
    try {
      const user = auth.currentUser;
      if (!user) {
        patchCam(boxId, { addBusy: false, addError: "Niet aangemeld" });
        console.error("[handleAddCamera] auth.currentUser is null");
        return;
      }
      const token = await user.getIdToken();
      const body: Record<string, string> = { macAddress: cam.addMac.trim() };
      if (cam.addLabel.trim()) body.label = cam.addLabel.trim();

      const res = await fetch(apiUrl(`/operations/boxes/${encodeURIComponent(boxId)}/cameras`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[handleAddCamera] API fout", res.status, data);
        patchCam(boxId, { addBusy: false, addError: data.message || "Kon camera niet aanmaken" });
        return;
      }
      patchCam(boxId, { addBusy: false, addOpen: false, addMac: "", addLabel: "", addError: "" });
      await loadCameras(boxId);
    } catch (err) {
      console.error("[handleAddCamera] Uitzondering voor box", boxId, err);
      patchCam(boxId, { addBusy: false, addError: "Netwerkfout bij aanmaken camera" });
    }
  }

  async function handleDeleteCamera(boxId: string, cameraId: string) {
    patchCam(boxId, { deletingId: cameraId });
    try {
      const user = auth.currentUser;
      if (!user) {
        patchCam(boxId, { deletingId: null, error: "Niet aangemeld" });
        console.error("[handleDeleteCamera] auth.currentUser is null");
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch(
        apiUrl(`/operations/boxes/${encodeURIComponent(boxId)}/cameras/${encodeURIComponent(cameraId)}`),
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json();
        console.error("[handleDeleteCamera] API fout", res.status, data);
        patchCam(boxId, { deletingId: null, error: data.message || "Kon camera niet verwijderen" });
        return;
      }
      patchCam(boxId, { deletingId: null });
      await loadCameras(boxId);
    } catch (err) {
      console.error("[handleDeleteCamera] Uitzondering voor box", boxId, err);
      patchCam(boxId, { deletingId: null, error: "Netwerkfout bij verwijderen camera" });
    }
  }

  async function handleTriggerUpdate(boxId: string, targetVersion: string) {
    setTriggerBusy((prev) => ({ ...prev, [boxId]: true }));
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(
        apiUrl(`/operations/boxes/${encodeURIComponent(boxId)}/trigger-update`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ targetVersion }),
        }
      );
      if (res.ok) {
        setBoxes((prev) =>
          prev.map((b) => b.id === boxId ? { ...b, targetVersion } : b)
        );
      }
    } catch (err) {
      console.error("[handleTriggerUpdate] fout", err);
    } finally {
      setTriggerBusy((prev) => ({ ...prev, [boxId]: false }));
    }
  }

  async function handleTriggerAll() {
    if (!latestVersion) return;
    setTriggerAllBusy(true);
    setConfirmAll(false);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(apiUrl("/operations/software/trigger-all"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ targetVersion: latestVersion }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error("[handleTriggerAll] fout", err);
    } finally {
      setTriggerAllBusy(false);
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadData();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const totalBoxes = boxes.length;
  const onlineBoxes = boxes.filter((b) => isPiOnline(b.lastHeartbeatAt)).length;
  const offlineBoxes = totalBoxes - onlineBoxes;
  const warningBoxes = boxes.filter(
    (b) => isCreditExpiringSoon(b.rms?.creditExpireDate ?? null)
  ).length;
  const upToDateBoxes = boxes.filter(
    (b) => b.versionRaspberry && latestVersion && b.versionRaspberry === latestVersion
  ).length;
  const behindBoxes = boxes.filter(
    (b) => b.versionRaspberry && latestVersion && b.versionRaspberry !== latestVersion
  ).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">

        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Technisch beheer
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Operations Center</h1>
            <p className="mt-2 text-sm text-slate-500">
              Real-time status van alle Gridboxen, routers en netwerken.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => loadData()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ververs
            </button>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <AuthPanel />
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-500">Totaal boxen</div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{totalBoxes}</div>
          </div>
          <div className="rounded-3xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <div className="text-sm text-green-700">Pi online</div>
            <div className="mt-3 text-3xl font-bold text-green-900">{onlineBoxes}</div>
          </div>
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="text-sm text-red-700">Pi offline</div>
            <div className="mt-3 text-3xl font-bold text-red-900">{offlineBoxes}</div>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="text-sm text-amber-700">Credit verloopt binnenkort</div>
            <div className="mt-3 text-3xl font-bold text-amber-900">{warningBoxes}</div>
          </div>
        </div>

        {/* ── Software update kaart ── */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <div className="text-xs text-slate-500">Laatste versie (GitHub)</div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900">
                  {latestVersion ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Up-to-date</div>
                <div className="mt-1 text-lg font-bold text-green-700">{upToDateBoxes}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Achter</div>
                <div className="mt-1 text-lg font-bold text-amber-700">{behindBoxes}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {confirmAll ? (
                <>
                  <span className="text-sm text-slate-600">
                    Alle online boxes updaten naar <span className="font-mono font-bold">{latestVersion}</span>?
                  </span>
                  <button
                    type="button"
                    disabled={triggerAllBusy}
                    onClick={handleTriggerAll}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    Ja, update alle
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAll(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Annuleer
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!latestVersion || triggerAllBusy}
                  onClick={() => setConfirmAll(true)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {triggerAllBusy ? "Bezig..." : `Alle boxes updaten naar ${latestVersion ?? "..."}`}
                </button>
              )}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Data ophalen...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {boxes.map((box) => {
              const piOnline = isPiOnline(box.lastHeartbeatAt);
              const rmsOnline = box.rms?.rmsStatus === "online";
              const creditWarn = isCreditExpiringSoon(box.rms?.creditExpireDate ?? null);
              const cam = cameraState[box.id] ?? DEFAULT_CAM_STATE;
              const versionKnown = box.versionRaspberry && box.targetVersion;
              const versionMatch = versionKnown && box.versionRaspberry === box.targetVersion;

              return (
                <div
                  key={box.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  {/* ── Kop ── */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold text-slate-900">
                        {box.boxId || box.id}
                      </div>
                      {box.siteId && (
                        <div className="mt-0.5 text-xs text-slate-500">{box.siteId}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${piOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                        Pi {piOnline ? "online" : "offline"}
                      </span>
                      {box.rms && (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${rmsOnline ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          Router {rmsOnline ? "online" : "offline"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Versie badge + update knop ── */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {versionKnown ? (
                      versionMatch ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          {box.versionRaspberry}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"
                          title={`Target: ${box.targetVersion}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {box.versionRaspberry} → {box.targetVersion}
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        versie onbekend
                      </span>
                    )}
                    {latestVersion && box.versionRaspberry && box.versionRaspberry !== latestVersion && (
                      <button
                        type="button"
                        disabled={!!triggerBusy[box.id]}
                        onClick={() => handleTriggerUpdate(box.id, latestVersion)}
                        className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
                      >
                        {triggerBusy[box.id] ? "..." : `Update → ${latestVersion}`}
                      </button>
                    )}
                  </div>

                  {/* ── Netwerk/Pi details ── */}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Signaal</div>
                      <div className="font-semibold text-slate-900">
                        {box.rms?.signal !== null && box.rms?.signal !== undefined
                          ? `${box.rms.signal} dBm`
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Operator</div>
                      <div className="font-semibold text-slate-900">{box.rms?.operator || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Temperatuur</div>
                      <div className="font-semibold text-slate-900">
                        {box.rms?.temperature !== null && box.rms?.temperature !== undefined
                          ? `${box.rms.temperature}°C`
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Router uptime</div>
                      <div className="font-semibold text-slate-900">
                        {formatUptime(box.rms?.routerUptime ?? null)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Firmware</div>
                      <div className="font-semibold text-slate-900 text-xs leading-5">
                        {box.rms?.firmware || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Laatste heartbeat</div>
                      <div className="font-semibold text-slate-900 text-xs leading-5">
                        {formatDate(box.lastHeartbeatAt)}
                      </div>
                    </div>
                  </div>

                  {box.rms?.creditExpireDate && (
                    <div className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold ${creditWarn ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
                      Credit verloopt: {box.rms.creditExpireDate.slice(0, 10)}
                    </div>
                  )}

                  {/* ── Camera-sectie ── */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleCameraSection(box.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
                      >
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/>
                          <circle cx="12" cy="13" r="3"/>
                        </svg>
                        Camera&apos;s
                        {cam.cameras.length > 0 && (
                          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {cam.cameras.length}
                          </span>
                        )}
                      </button>

                      {cam.isOpen && (
                        <button
                          type="button"
                          onClick={() => patchCam(box.id, { addOpen: true, addError: "" })}
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-slate-700"
                        >
                          + Nieuwe camera
                        </button>
                      )}
                    </div>

                    {cam.loading && (
                      <div className="mt-3 text-xs text-slate-400">Camera&apos;s ophalen...</div>
                    )}

                    {cam.error && (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {cam.error}
                      </div>
                    )}

                    {!cam.loading && cam.cameras.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {cam.cameras.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-semibold text-slate-900">{c.ip}</span>
                              <div className="flex items-center gap-2">
                                {c.label && (
                                  <span className="text-xs text-slate-500">{c.label}</span>
                                )}
                                <button
                                  type="button"
                                  disabled={cam.deletingId === c.id}
                                  onClick={() => handleDeleteCamera(box.id, c.id)}
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                                  title="Camera verwijderen"
                                >
                                  {cam.deletingId === c.id ? (
                                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                                  ) : (
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                            {c.macAddress && (
                              <div className="mt-1 text-[11px] text-slate-400">
                                MAC: <span className="font-mono">{c.macAddress}</span>
                              </div>
                            )}
                            <div className="mt-1 truncate text-[11px] text-slate-400" title={c.snapshotUrl}>
                              {c.snapshotUrl}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!cam.loading && cam.isOpen && cam.cameras.length === 0 && !cam.error && (
                      <div className="mt-3 text-xs text-slate-400">Nog geen camera&apos;s geregistreerd.</div>
                    )}

                    {/* Toevoegformulier */}
                    {cam.addOpen && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {cam.suggestedIp && (
                          <div className="mb-2 text-[11px] text-slate-500">
                            Voorgesteld IP: <span className="font-mono font-semibold text-slate-700">{cam.suggestedIp}</span>
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder="MAC-adres (bijv. AA:BB:CC:DD:EE:FF)"
                          value={cam.addMac}
                          onChange={(e) => patchCam(box.id, { addMac: e.target.value, addError: "" })}
                          className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="Label (optioneel)"
                          value={cam.addLabel}
                          onChange={(e) => patchCam(box.id, { addLabel: e.target.value })}
                          className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-900"
                        />
                        {cam.addError && (
                          <div className="mb-2 text-xs text-red-600">{cam.addError}</div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={cam.addBusy}
                            onClick={() => handleAddCamera(box.id)}
                            className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
                          >
                            {cam.addBusy ? "Bezig..." : "Toevoegen"}
                          </button>
                          <button
                            type="button"
                            disabled={cam.addBusy}
                            onClick={() => patchCam(box.id, { addOpen: false, addMac: "", addLabel: "", addError: "" })}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Annuleer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {boxes.length === 0 && (
              <div className="col-span-3 rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                Geen boxen gevonden.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
