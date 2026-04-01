"use client";

import { ActiveSection } from "../types";

type AdminDashboardSectionProps = {
  activeCustomersCount: number;
  totalCustomersCount: number;
  membershipCount: number;
  pendingInviteCount: number;
  activeAccessCount: number;
  onSectionChange: (section: ActiveSection) => void;
};

export default function AdminDashboardSection({
  activeCustomersCount,
  totalCustomersCount,
  membershipCount,
  pendingInviteCount,
  activeAccessCount,
  onSectionChange
}: AdminDashboardSectionProps) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Actieve bedrijven</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{activeCustomersCount}</div>
          <div className="mt-2 text-sm text-slate-500">
            Totaal bedrijven in admin: {totalCustomersCount}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Gebruikerstoegang</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{membershipCount}</div>
          <div className="mt-2 text-sm text-slate-500">
            Effectieve memberships in deze snapshot
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Openstaande uitnodigingen</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{pendingInviteCount}</div>
          <div className="mt-2 text-sm text-slate-500">
            Invite eerst, toegang pas na activatie
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Actieve box-toegangen</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{activeAccessCount}</div>
          <div className="mt-2 text-sm text-slate-500">
            Klant-boxkoppelingen die vandaag actief zijn
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Snelle acties</h2>
              <p className="mt-1 text-sm text-slate-500">
                Eerst structuur. Daarna pas verdere opsplitsing en backendverrijking.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => onSectionChange("customers")}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:bg-slate-100"
            >
              <div className="text-base font-bold text-slate-900">Klanten beheren</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Bedrijven aanmaken, selecteren en activeren of deactiveren.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSectionChange("invites")}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:bg-slate-100"
            >
              <div className="text-base font-bold text-slate-900">Uitnodigingen</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Nieuwe invites aanmaken en openstaande uitnodigingen beheren.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSectionChange("memberships")}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:bg-slate-100"
            >
              <div className="text-base font-bold text-slate-900">Gebruikerstoegang</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Effectieve memberships bekijken en waar nodig verwijderen.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSectionChange("provisioning")}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:bg-slate-100"
            >
              <div className="text-base font-bold text-slate-900">Installatiecockpit</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Nieuwe wizardstructuur voor provisioning. In deze slice nog als shell.
              </p>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-green-900">Wat al werkt</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-green-900">
              <li>Klanten ophalen en aanmaken</li>
              <li>Memberships ophalen en verwijderen</li>
              <li>Invites ophalen, aanmaken en verwijderen</li>
              <li>Box-toegang koppelen en activeren of deactiveren</li>
              <li>Rollen ophalen via /admin/roles</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-amber-900">Nog bewust niet afgewerkt</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-amber-900">
              <li>Installatiecockpit is nog geen echte provisioningflow</li>
              <li>Provisioning logs zijn nog geen live scherm</li>
              <li>Sites zitten in deze slice nog niet op een eigen endpoint</li>
              <li>Er wordt nog geen e-mail automatisch verstuurd bij invite</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
