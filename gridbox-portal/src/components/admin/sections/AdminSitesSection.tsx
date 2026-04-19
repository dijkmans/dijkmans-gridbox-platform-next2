"use client";

import { FormEvent, useState } from "react";
import type { AdminSiteItem, CustomerItem } from "@/components/admin/types";

type AdminSitesSectionProps = {
  sites: AdminSiteItem[];
  boxes: { id: string; siteId?: string | null }[];
  customers: CustomerItem[];
  onUpdateSite: (siteId: string, data: {
    name?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  }) => void | Promise<void>;
  onCreateSite: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  newSiteId: string;
  newSiteName: string;
  newSiteAddress: string;
  newSiteCity: string;
  newSitePostalCode: string;
  newSiteCountry: string;
  newSiteCustomerId: string;
  onNewSiteIdChange: (v: string) => void;
  onNewSiteNameChange: (v: string) => void;
  onNewSiteAddressChange: (v: string) => void;
  onNewSiteCityChange: (v: string) => void;
  onNewSitePostalCodeChange: (v: string) => void;
  onNewSiteCountryChange: (v: string) => void;
  onNewSiteCustomerIdChange: (v: string) => void;
};

export default function AdminSitesSection({
  sites,
  boxes,
  customers,
  onUpdateSite,
  onCreateSite,
  newSiteId,
  newSiteName,
  newSiteAddress,
  newSiteCity,
  newSitePostalCode,
  newSiteCountry,
  newSiteCustomerId,
  onNewSiteIdChange,
  onNewSiteNameChange,
  onNewSiteAddressChange,
  onNewSiteCityChange,
  onNewSitePostalCodeChange,
  onNewSiteCountryChange,
  onNewSiteCustomerIdChange
}: AdminSitesSectionProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null;
  const siteBoxCount = selectedSite ? boxes.filter((b) => b.siteId === selectedSite.id).length : 0;

  function selectSite(siteId: string) {
    setSelectedSiteId(siteId);
    setEditMode(false);
  }

  function startEdit() {
    if (!selectedSite) return;
    setEditName(selectedSite.name ?? "");
    setEditAddress(selectedSite.address ?? "");
    setEditCity(selectedSite.city ?? "");
    setEditPostalCode(selectedSite.postalCode ?? "");
    setEditCountry(selectedSite.country ?? "");
    setEditMode(true);
  }

  async function handleSaveEdit() {
    if (!selectedSite) return;
    setEditBusy(true);
    await onUpdateSite(selectedSite.id, {
      name: editName,
      address: editAddress,
      city: editCity,
      postalCode: editPostalCode,
      country: editCountry
    });
    setEditMode(false);
    setEditBusy(false);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
      {/* Linkerkolom: sitelijst */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Sites</h2>
        <p className="mt-1 text-sm text-slate-500">Kies een site om de details te bekijken.</p>

        <div className="mt-6 space-y-3">
          {sites.map((site) => {
            const isSelected = selectedSiteId === site.id;
            const boxCount = boxes.filter((b) => b.siteId === site.id).length;

            return (
              <button
                key={site.id}
                type="button"
                onClick={() => selectSite(site.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold">{site.name || site.id}</div>
                    <div className={`mt-1 text-sm ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      {site.city ? `${site.city}` : site.id}
                    </div>
                  </div>
                  {site.active === false && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      Inactief
                    </span>
                  )}
                </div>
                <div className={`mt-3 text-sm ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                  Boxen: {boxCount}
                </div>
              </button>
            );
          })}

          {sites.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Geen sites gevonden.
            </div>
          )}
        </div>
      </div>

      {/* Nieuw site formulier */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Nieuwe site</h3>
        <p className="mt-1 text-sm text-slate-500">Maak een nieuwe locatie aan.</p>

        <form onSubmit={onCreateSite} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Site ID <span className="text-red-500">*</span></label>
            <input
              value={newSiteId}
              onChange={(e) => onNewSiteIdChange(e.target.value)}
              placeholder="bv. gent-noord"
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Naam <span className="text-red-500">*</span></label>
            <input
              value={newSiteName}
              onChange={(e) => onNewSiteNameChange(e.target.value)}
              placeholder="bv. Gent Noord"
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Adres</label>
            <input
              value={newSiteAddress}
              onChange={(e) => onNewSiteAddressChange(e.target.value)}
              placeholder="Straat + nummer"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Postcode</label>
              <input
                value={newSitePostalCode}
                onChange={(e) => onNewSitePostalCodeChange(e.target.value)}
                placeholder="9000"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Stad</label>
              <input
                value={newSiteCity}
                onChange={(e) => onNewSiteCityChange(e.target.value)}
                placeholder="Gent"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Land</label>
            <input
              value={newSiteCountry}
              onChange={(e) => onNewSiteCountryChange(e.target.value)}
              placeholder="België"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Klant</label>
            <select
              value={newSiteCustomerId}
              onChange={(e) => onNewSiteCustomerIdChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            >
              <option value="">— kies klant —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ? `${c.name} (${c.id})` : c.id}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            Site aanmaken
          </button>
        </form>
      </div>
    </div>

      {/* Rechterkolom: detail + edit */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {selectedSite ? (
          <>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Geselecteerde site
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {selectedSite.name || selectedSite.id}
                </h2>
                {selectedSite.city && (
                  <p className="mt-1 text-sm text-slate-500">{selectedSite.city}</p>
                )}
              </div>

              {!editMode && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  ✏️ Bewerken
                </button>
              )}
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Adres</label>
                  <input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Straat + nummer"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Postcode</label>
                    <input
                      value={editPostalCode}
                      onChange={(e) => setEditPostalCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Stad</label>
                    <input
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Land</label>
                  <input
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    placeholder="bv. België"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Site ID</span>
                    <span className="font-mono text-slate-700">{selectedSite.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Klant</span>
                    <span className="text-slate-700">{selectedSite.customerId ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Aantal boxen</span>
                    <span className="text-slate-700">{siteBoxCount}</span>
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
                    onClick={() => setEditMode(false)}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Site ID</span>
                    <span className="font-mono text-slate-700">{selectedSite.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Klant</span>
                    <span className="text-slate-700">{selectedSite.customerId ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Naam</span>
                    <span className="text-slate-700">{selectedSite.name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Adres</span>
                    <span className="text-slate-700">{selectedSite.address ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Postcode</span>
                    <span className="text-slate-700">{selectedSite.postalCode ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Stad</span>
                    <span className="text-slate-700">{selectedSite.city ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Land</span>
                    <span className="text-slate-700">{selectedSite.country ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Aantal boxen</span>
                    <span className="text-slate-700">{siteBoxCount}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Kies links een site.
          </div>
        )}
      </div>
    </section>
  );
}
