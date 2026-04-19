"use client";

import { FormEvent, useState } from "react";

type CustomerSummaryItem = {
  id: string;
  name?: string;
  active?: boolean;
  logoPath?: string;
  createdAt?: string;
  addedBy?: string;
  memberCount: number;
  accessCount: number;
};

type SelectedCustomerItem = {
  id: string;
  name?: string;
  active?: boolean;
  logoPath?: string;
  createdAt?: string;
  addedBy?: string;
};

type AdminCustomersSectionProps = {
  customers: CustomerSummaryItem[];
  selectedCustomerId: string | null;
  selectedCustomer: SelectedCustomerItem | null;
  customerMemberCount: number;
  customerInviteCount: number;
  customerAccessCount: number;
  newCustomerId: string;
  newCustomerName: string;
  onSelectCustomer: (customerId: string) => void;
  onNewCustomerIdChange: (value: string) => void;
  onNewCustomerNameChange: (value: string) => void;
  onCreateCustomer: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onToggleCustomerStatus: (customerId: string, nextActive: boolean) => void | Promise<void>;
  onUpdateCustomer: (customerId: string, data: { name?: string; logoPath?: string }) => void | Promise<void>;
};

export default function AdminCustomersSection({
  customers,
  selectedCustomerId,
  selectedCustomer,
  customerMemberCount,
  customerInviteCount,
  customerAccessCount,
  newCustomerId,
  newCustomerName,
  onSelectCustomer,
  onNewCustomerIdChange,
  onNewCustomerNameChange,
  onCreateCustomer,
  onToggleCustomerStatus,
  onUpdateCustomer
}: AdminCustomersSectionProps) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLogoPath, setEditLogoPath] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  function startEdit() {
    setEditName(selectedCustomer?.name ?? "");
    setEditLogoPath(selectedCustomer?.logoPath ?? "");
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
  }

  async function handleSaveEdit() {
    if (!selectedCustomer) return;
    setEditBusy(true);
    await onUpdateCustomer(selectedCustomer.id, { name: editName, logoPath: editLogoPath });
    setEditMode(false);
    setEditBusy(false);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Klanten</h2>
              <p className="mt-1 text-sm text-slate-500">
                Kies een bedrijf om de basisgegevens te bekijken.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {customers.map((customer) => {
              const isSelected = selectedCustomerId === customer.id;

              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => { onSelectCustomer(customer.id); setEditMode(false); }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-bold">{customer.name || customer.id}</div>
                      <div className={`mt-1 text-sm ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                        {customer.id}
                      </div>
                    </div>
                    {customer.active === false && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        Inactief
                      </span>
                    )}
                  </div>

                  <div className={`mt-4 flex gap-4 text-sm ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                    <span>Leden: {customer.memberCount}</span>
                    <span>Boxen: {customer.accessCount}</span>
                  </div>
                </button>
              );
            })}

            {customers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Er zijn nog geen klanten geladen.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Nieuw bedrijf</h3>
          <p className="mt-1 text-sm text-slate-500">
            Maak een nieuw bedrijf aan in de admin.
          </p>

          <form onSubmit={onCreateCustomer} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Bedrijf ID</label>
              <input
                value={newCustomerId}
                onChange={(e) => onNewCustomerIdChange(e.target.value)}
                placeholder="bv. powergrid"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Bedrijf naam</label>
              <input
                value={newCustomerName}
                onChange={(e) => onNewCustomerNameChange(e.target.value)}
                placeholder="bv. Powergrid"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Bedrijf toevoegen
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {selectedCustomer ? (
          <>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Geselecteerd bedrijf
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {selectedCustomer.name || selectedCustomer.id}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{selectedCustomer.id}</p>
              </div>

              <div className="flex gap-2">
                {!editMode && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    ✏️ Bewerken
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleCustomerStatus(selectedCustomer.id, !(selectedCustomer.active !== false))}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    selectedCustomer.active !== false
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {selectedCustomer.active !== false ? "Bedrijf deactiveren" : "Bedrijf activeren"}
                </button>
              </div>
            </div>

            {editMode ? (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Naam</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Logo pad (GCS path)</label>
                  <input
                    value={editLogoPath}
                    onChange={(e) => setEditLogoPath(e.target.value)}
                    placeholder="bv. logos/powergrid.png"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Document ID</span>
                    <span className="font-mono text-slate-700">{selectedCustomer.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Aangemaakt op</span>
                    <span className="text-slate-700">{selectedCustomer.createdAt ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Aangemaakt door</span>
                    <span className="text-slate-700">{selectedCustomer.addedBy ?? "—"}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={editBusy}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {editBusy ? "Opslaan…" : "Opslaan"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm text-slate-500">Gebruikerstoegang</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{customerMemberCount}</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm text-slate-500">Openstaande invites</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{customerInviteCount}</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm text-slate-500">Gekoppelde boxen</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{customerAccessCount}</div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-900">
                  Dit scherm toont nu bewust alleen de klantbasis. Voor uitnodigingen,
                  effectieve toegang en boxkoppelingen gebruik je de aparte secties.
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Kies links een bedrijf.
          </div>
        )}
      </div>
    </section>
  );
}
