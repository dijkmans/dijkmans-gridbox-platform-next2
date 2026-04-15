"use client";

import type { AdminProvisioningItem, CustomerItem } from "../types";

type AdminLogsSectionProps = {
  provisioningItems: AdminProvisioningItem[];
  customers: CustomerItem[];
  provisioningStatusLabels: Record<string, string>;
  formatDate: (value?: string | null | { _seconds: number; _nanoseconds: number }) => string;
  onDeleteProvisioning: (provisioningId: string, boxId: string | null) => void | Promise<void>;
};

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-green-100 text-green-800",
  online: "bg-emerald-100 text-emerald-800",
  claimed: "bg-blue-100 text-blue-800",
  awaiting_first_boot: "bg-amber-100 text-amber-800",
  awaiting_sd_preparation: "bg-amber-100 text-amber-800",
  draft: "bg-slate-100 text-slate-700",
  failed: "bg-red-100 text-red-700",
};

export default function AdminLogsSection({
  provisioningItems,
  customers,
  provisioningStatusLabels,
  formatDate,
  onDeleteProvisioning,
}: AdminLogsSectionProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Provisioning overzicht</h2>
        <p className="mt-2 text-sm text-slate-500">
          Alle provisionings gesorteerd op aanmaakdatum.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-semibold">Box ID</th>
                <th className="pb-3 pr-4 font-semibold">Klant</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 pr-4 font-semibold">Laatste heartbeat</th>
                <th className="pb-3 pr-4 font-semibold">Aangemaakt op</th>
                <th className="pb-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {provisioningItems.map((item) => {
                const statusLabel =
                  provisioningStatusLabels[item.status ?? ""] || item.status || "-";
                const statusStyle =
                  STATUS_STYLES[item.status ?? ""] || "bg-slate-100 text-slate-700";
                const customerName =
                  customers.find((c) => c.id === item.customerId)?.name ||
                  item.customerId ||
                  "-";

                return (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-4 pr-4 font-semibold text-slate-900">
                      {item.boxId || item.id}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{customerName}</td>
                    <td className="py-4 pr-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {formatDate(item.lastHeartbeatAt)}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{formatDate(item.createdAt)}</td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => {
                          const boxLabel = item.boxId || item.id;
                          if (window.confirm(`Ben je zeker? Dit verwijdert provisioning ${item.id} en box ${boxLabel} permanent.`)) {
                            onDeleteProvisioning(item.id, item.boxId ?? null);
                          }
                        }}
                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        title="Verwijder provisioning en box"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}

              {provisioningItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-slate-500">
                    Geen provisionings gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
