"use client";

import { FormEvent } from "react";

type MembershipListItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
};

type CustomerListItem = {
  id: string;
  name?: string;
};

type CustomerAccessListItem = {
  id: string;
  boxId?: string;
  active?: boolean;
};

type BoxListItem = {
  id: string;
  boxId?: string;
  siteId?: string | null;
};

type AdminMembershipsSectionProps = {
  selectedCustomerName: string;
  customerMemberCount: number;
  customerAccessCount: number;
  accessBoxId: string;
  sortedBoxes: BoxListItem[];
  memberships: MembershipListItem[];
  customers: CustomerListItem[];
  customerAccess: CustomerAccessListItem[];
  getRoleLabel: (roleId: string | undefined) => string;
  getBoxLabel: (box: BoxListItem) => string;
  onAccessBoxIdChange: (value: string) => void;
  onCreateAccess: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDeleteMembership: (membershipId: string, email: string) => void | Promise<void>;
  onToggleAccessStatus: (accessId: string, nextActive: boolean) => void | Promise<void>;
};

export default function AdminMembershipsSection({
  selectedCustomerName,
  customerMemberCount,
  customerAccessCount,
  accessBoxId,
  sortedBoxes,
  memberships,
  customers,
  customerAccess,
  getRoleLabel,
  getBoxLabel,
  onAccessBoxIdChange,
  onCreateAccess,
  onDeleteMembership,
  onToggleAccessStatus
}: AdminMembershipsSectionProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Geselecteerd bedrijf</h2>
          <p className="mt-1 text-sm text-slate-500">
            Handig om leden en boxtoegang per bedrijf te bekijken.
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Bedrijf</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{selectedCustomerName}</div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Leden</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {customerMemberCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Boxtoegang</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {customerAccessCount}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Boxen koppelen</h3>
          <p className="mt-1 text-sm text-slate-500">
            Koppel een box aan het geselecteerde bedrijf.
          </p>

          <form onSubmit={onCreateAccess} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Gridbox
              </label>
              <select
                value={accessBoxId}
                onChange={(e) => onAccessBoxIdChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">-- Selecteer een Gridbox --</option>
                {sortedBoxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {getBoxLabel(box)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Box toewijzen
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Gebruikerstoegang</h2>
          <p className="mt-2 text-sm text-slate-500">
            Effectieve memberships. Dit is dus niet hetzelfde als een invite.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 pr-4 font-semibold">E-mail</th>
                  <th className="pb-3 pr-4 font-semibold">Bedrijf</th>
                  <th className="pb-3 pr-4 font-semibold">Rol</th>
                  <th className="pb-3 text-right font-semibold">Acties</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((member) => (
                  <tr key={member.id} className="border-b border-slate-100">
                    <td className="py-4 pr-4 text-slate-900">{member.email || "-"}</td>
                    <td className="py-4 pr-4 text-slate-600">
                      {customers.find((customer) => customer.id === member.customerId)?.name ||
                        member.customerId ||
                        "-"}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {getRoleLabel(member.role)}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteMembership(member.id, member.email || "deze persoon")}
                        className="rounded-xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                      >
                        Verwijderen
                      </button>
                    </td>
                  </tr>
                ))}

                {memberships.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-slate-500">
                      Geen memberships gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Gekoppelde boxen</h3>
          <p className="mt-1 text-sm text-slate-500">
            Beheer per bedrijf welke boxen actief gekoppeld zijn.
          </p>

          <div className="mt-5 space-y-3">
            {customerAccess.map((access) => {
              const box = sortedBoxes.find(
                (candidate) => candidate.id === access.boxId || candidate.boxId === access.boxId
              );

              return (
                <div
                  key={access.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {box ? getBoxLabel(box) : access.boxId || "-"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Status: {access.active !== false ? "Actief" : "Inactief"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleAccessStatus(access.id, !(access.active !== false))}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {access.active !== false ? "Ontkoppelen" : "Heractiveren"}
                  </button>
                </div>
              );
            })}

            {customerAccess.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Dit bedrijf heeft nog geen gekoppelde boxen.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
