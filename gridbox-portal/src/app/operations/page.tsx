"use client";

import { useEffect, useState } from "react";
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

export default function OperationsPage() {
  const [boxes, setBoxes] = useState<OperationsBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

      setBoxes(data.items || []);
    } catch {
      setErrorMessage("Netwerkfout bij ophalen operationsdata");
    } finally {
      setLoading(false);
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

              return (
                <div
                  key={box.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
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
