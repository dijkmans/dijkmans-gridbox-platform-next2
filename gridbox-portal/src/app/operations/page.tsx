"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import AuthPanel from "@/components/AuthPanel";
import { apiUrl } from "@/lib/api";

type RmsSummary = {
  rmsStatus: "online" | "offline" | null;
  rmsName: string | null;
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

type BoxSoftware = {
  currentVersion?: string | null;
  targetVersion?: string | null;
  updateStatus?: string | null;
  deploymentStatus?: string | null;
  lastError?: string | null;
  gitCommitLocal?: string | null;
  softwareUpdateRequested?: boolean | null;
  piModel?: string | null;
  platform?: string | null;
  pythonVersion?: string | null;
  gatewayIp?: string | null;
  gatewayMac?: string | null;
  restartDelaySeconds?: number | null;
  serviceName?: string | null;
  lastHeartbeatIso?: string | null;
  lastHeartbeatUnix?: number | null;
};

type OperationsBoxItem = {
  id: string;
  boxId?: string;
  customerId?: string | null;
  siteId?: string | null;
  status?: string | null;
  lastHeartbeatAt?: string | { _seconds: number; _nanoseconds: number } | null;
  rmsDeviceId?: number | null;
  gatewayMac?: string | null;
  software?: BoxSoftware | null;
  rms: RmsSummary | null;
  hardware?: { camera?: { ip?: string; mac?: string; snapshotUrl?: string; enabled?: boolean } } | null;
};

type RouterGroup = {
  key: string;
  rmsDeviceId: number | null;
  rms: RmsSummary | null;
  boxes: OperationsBoxItem[];
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

function creditDaysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days;
}

function isCreditExpiringSoon(dateStr: string | null): boolean {
  const days = creditDaysRemaining(dateStr);
  return days !== null && days <= 30;
}

function buildGroups(boxes: OperationsBoxItem[]): RouterGroup[] {
  const map = new Map<string, RouterGroup>();
  for (const box of boxes) {
    const key = box.rmsDeviceId != null ? String(box.rmsDeviceId) : "__unknown__";
    if (!map.has(key)) {
      map.set(key, { key, rmsDeviceId: box.rmsDeviceId ?? null, rms: box.rms, boxes: [] });
    }
    map.get(key)!.boxes.push(box);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.key === "__unknown__") return 1;
    if (b.key === "__unknown__") return -1;
    return (a.rmsDeviceId ?? 0) - (b.rmsDeviceId ?? 0);
  });
}

function DiagnosePanel({ sw, onClose }: { sw: BoxSoftware; onClose: () => void }) {
  const mono = "font-mono text-xs text-slate-800";
  const label = "text-xs text-slate-500 mb-0.5";
  const row = "flex justify-between gap-4 py-1 border-b border-slate-100 last:border-0";
  const sectionTitle = "text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 mt-4 first:mt-0";

  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs shadow-inner">

      <div className={sectionTitle}>Software &amp; Update</div>
      <div className="space-y-0">
        <div className={row}>
          <span className={label}>Huidige versie</span>
          <span className={mono}>{sw.currentVersion || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Target versie</span>
          <span className={mono}>{sw.targetVersion || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Status</span>
          <span className={`font-semibold font-mono text-xs ${sw.deploymentStatus === "ON_TARGET" ? "text-green-700" : sw.deploymentStatus ? "text-amber-600" : "text-slate-500"}`}>
            {sw.deploymentStatus || "-"}
          </span>
        </div>
        <div className={row}>
          <span className={label}>Update status</span>
          <span className={mono}>{sw.updateStatus || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Update aangevraagd</span>
          <span className={mono}>{sw.softwareUpdateRequested === true ? "ja" : sw.softwareUpdateRequested === false ? "nee" : "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Git commit</span>
          <span className={mono}>{sw.gitCommitLocal ? sw.gitCommitLocal.slice(0, 12) : "-"}</span>
        </div>
        {sw.lastError && (
          <div className="mt-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
            <div className="text-xs font-semibold text-red-700 mb-1">Last error</div>
            <div className="font-mono text-xs text-red-800 break-all">{sw.lastError}</div>
          </div>
        )}
      </div>

      <div className={sectionTitle}>Hardware</div>
      <div className="space-y-0">
        <div className={row}>
          <span className={label}>Pi model</span>
          <span className={mono}>{sw.piModel || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Platform</span>
          <span className={mono}>{sw.platform || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Python</span>
          <span className={mono}>{sw.pythonVersion || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Service</span>
          <span className={mono}>{sw.serviceName || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Restart delay</span>
          <span className={mono}>{sw.restartDelaySeconds != null ? `${sw.restartDelaySeconds}s` : "-"}</span>
        </div>
      </div>

      <div className={sectionTitle}>Netwerk</div>
      <div className="space-y-0">
        <div className={row}>
          <span className={label}>Gateway IP</span>
          <span className={mono}>{sw.gatewayIp || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Gateway MAC</span>
          <span className={mono}>{sw.gatewayMac || "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Laatste heartbeat</span>
          <span className={mono}>{sw.lastHeartbeatIso ? formatDate(sw.lastHeartbeatIso) : "-"}</span>
        </div>
        <div className={row}>
          <span className={label}>Heartbeat Unix</span>
          <span className={mono}>{sw.lastHeartbeatUnix != null ? String(sw.lastHeartbeatUnix) : "-"}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
      >
        Sluit
      </button>
    </div>
  );
}

export default function OperationsPage() {
  const [boxes, setBoxes] = useState<OperationsBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [diagnoseOpen, setDiagnoseOpen] = useState<Record<string, boolean>>({});

  function toggleDiagnose(boxId: string) {
    setDiagnoseOpen((prev) => ({ ...prev, [boxId]: !prev[boxId] }));
  }

  async function openSnapshot(boxId: string) {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera/snapshot`), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { setErrorMessage("Snapshot ophalen mislukt"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
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
      const res = await fetch(apiUrl("/operations/boxes"), {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Kon data niet ophalen");
        return;
      }

      setBoxes((data.items || []).map((item: any) => ({
        ...item,
        hardware: item.hardware ?? null
      })));
    } catch {
      setErrorMessage("Netwerkfout bij ophalen operationsdata");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) loadData();
      else setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const groups = buildGroups(boxes);
  const totalBoxes = boxes.length;
  const onlineBoxes = boxes.filter((b) => isPiOnline(b.lastHeartbeatAt)).length;
  const offlineBoxes = totalBoxes - onlineBoxes;
  const warningBoxes = boxes.filter((b) => isCreditExpiringSoon(b.rms?.creditExpireDate ?? null)).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">

        {/* Header */}
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

        {/* Stats */}
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
          <div className="flex flex-col gap-10">
            {groups.map((group) => {
              const rms = group.rms;
              const creditDays = creditDaysRemaining(rms?.creditExpireDate ?? null);
              const creditWarn = creditDays !== null && creditDays <= 30;
              const rmsOnline = rms?.rmsStatus === "online";
              const routerTitle = rms?.rmsName || (group.rmsDeviceId ? `Router ${group.rmsDeviceId}` : "Onbekende router");

              return (
                <div key={group.key}>

                  {/* Router block */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Router</div>
                        <div className="text-lg font-bold text-slate-900">{routerTitle}</div>
                      </div>
                      {rms && (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${rmsOnline ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          {rmsOnline ? "online" : "offline"}
                        </span>
                      )}
                    </div>

                    {rms ? (
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm md:grid-cols-4 lg:grid-cols-6">
                        <div>
                          <div className="text-xs text-slate-500">Operator</div>
                          <div className="font-semibold text-slate-900">{rms.operator || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Signaal</div>
                          <div className="font-semibold text-slate-900">
                            {rms.signal !== null && rms.signal !== undefined ? `${rms.signal} dBm` : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Type</div>
                          <div className="font-semibold text-slate-900">{rms.connectionType || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">RSRP</div>
                          <div className="font-semibold text-slate-900">
                            {rms.rsrp !== null && rms.rsrp !== undefined ? `${rms.rsrp} dBm` : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">SINR</div>
                          <div className="font-semibold text-slate-900">
                            {rms.sinr !== null && rms.sinr !== undefined ? `${rms.sinr} dB` : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Temperatuur</div>
                          <div className="font-semibold text-slate-900">
                            {rms.temperature !== null && rms.temperature !== undefined ? `${rms.temperature}°C` : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Uptime</div>
                          <div className="font-semibold text-slate-900">{formatUptime(rms.routerUptime)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Firmware</div>
                          <div className="font-semibold text-slate-900 text-xs leading-5">{rms.firmware || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Laatste verbinding</div>
                          <div className="font-semibold text-slate-900 text-xs leading-5">{formatDate(rms.lastConnectionAt)}</div>
                        </div>
                        {rms.iccid && (
                          <div className="col-span-2">
                            <div className="text-xs text-slate-500">SIM (ICCID)</div>
                            <div className="font-semibold text-slate-900 text-xs leading-5">{rms.iccid}</div>
                          </div>
                        )}
                        {rms.creditExpireDate && (
                          <div className={`col-span-2 self-end rounded-xl px-3 py-2 text-xs font-semibold ${
                            creditDays !== null && creditDays <= 10
                              ? "bg-red-100 text-red-800"
                              : creditDays !== null && creditDays <= 30
                              ? "bg-orange-100 text-orange-800"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            Credit verloopt: {rms.creditExpireDate.slice(0, 10)}{creditDays !== null ? ` (nog ${creditDays} dagen)` : ""}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">Geen RMS-data beschikbaar</div>
                    )}
                  </div>

                  {/* Vertical connector + Pi cards */}
                  <div className="ml-10 border-l-2 border-slate-300">
                    <div className="flex flex-wrap gap-4 py-2">
                      {group.boxes.map((box) => {
                        const piOnline = isPiOnline(box.lastHeartbeatAt);
                        const sw = box.software ?? {};
                        const version = sw.currentVersion || "-";
                        const updateStatus = sw.updateStatus;
                        const hasError = !!(sw.lastError);
                        const isOpen = diagnoseOpen[box.id] ?? false;

                        return (
                          <div key={box.id} className="relative ml-6 mt-2 min-w-[220px] max-w-xs flex-1">
                            {/* Horizontal connector */}
                            <div className="absolute -left-6 top-6 w-6 border-t-2 border-slate-300" />

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Pi</div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-bold text-slate-900">{box.boxId || box.id}</span>
                                    {hasError && (
                                      <span title={sw.lastError ?? ""} className="text-amber-500 text-sm leading-none">⚠</span>
                                    )}
                                  </div>
                                  {box.siteId && (
                                    <div className="text-xs text-slate-400">{box.siteId}</div>
                                  )}
                                </div>
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${piOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                                  {piOnline ? "online" : "offline"}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs mb-3">
                                <div className="flex justify-between gap-2">
                                  <span className="text-slate-500">Heartbeat</span>
                                  <span className="font-semibold text-slate-900 text-right">{formatDate(box.lastHeartbeatAt)}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-slate-500">Versie</span>
                                  <span className="font-semibold text-slate-900">{version}</span>
                                </div>
                                {updateStatus && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-slate-500">Update</span>
                                    <span className="font-semibold text-slate-900">{updateStatus}</span>
                                  </div>
                                )}
                                {box.hardware?.camera?.ip && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-slate-500">Camera</span>
                                    <button
                                      type="button"
                                      onClick={() => openSnapshot(box.boxId || box.id)}
                                      className="font-semibold text-blue-600 hover:underline text-xs"
                                    >
                                      📷 {box.hardware.camera.ip}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleDiagnose(box.id)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                              >
                                {isOpen ? "Verberg diagnose" : "Diagnose"}
                              </button>
                            </div>

                            {isOpen && sw && (
                              <DiagnosePanel sw={sw} onClose={() => toggleDiagnose(box.id)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })}

            {boxes.length === 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                Geen boxen gevonden.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
