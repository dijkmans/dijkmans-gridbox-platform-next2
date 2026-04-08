"use client";

import type { AdminProvisioningItem, CustomerItem } from "../types";

type AdminLogsSectionProps = {
  provisioningItems: AdminProvisioningItem[];
  customers: CustomerItem[];
  provisioningStatusLabels: Record<string, string>;
  formatDate: (value?: string | null | { _seconds: number; _nanoseconds: number }) => string;
  onDeleteProvisioning?: (id: string) => void;
  onSelectProvisioning?: (id: string) => void;
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
  onSelectProvisioning,
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
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                    onClick={() => onSelectProvisioning?.(item.id)}
                  >
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
                      {onDeleteProvisioning && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Provisioning ${item.boxId || item.id} verwijderen?`)) {
                              onDeleteProvisioning(item.id);
                            }
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          Verwijder
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {provisioningItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-slate-500">
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
