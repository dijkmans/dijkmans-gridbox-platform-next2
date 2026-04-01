"use client";

import { FormEvent } from "react";

type InviteRoleItem = {
  id: string;
  label: string;
};

type InviteListItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
  status?: string;
  createdAt?: string;
};

type CustomerListItem = {
  id: string;
  name?: string;
};

type AdminInvitesSectionProps = {
  selectedCustomerName: string;
  inviteEmail: string;
  inviteDisplayName: string;
  inviteRole: string;
  invitePermissions: string;
  inviteRoles: InviteRoleItem[];
  lastInviteUrl: string;
  pendingInvites: InviteListItem[];
  customers: CustomerListItem[];
  formatDate: (value?: string | null) => string;
  getRoleLabel: (roleId: string | undefined) => string;
  onInviteEmailChange: (value: string) => void;
  onInviteDisplayNameChange: (value: string) => void;
  onInviteRoleChange: (value: string) => void;
  onInvitePermissionsChange: (value: string) => void;
  onCreateInvite: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDeleteInvite: (inviteId: string, email: string) => void | Promise<void>;
};

export default function AdminInvitesSection({
  selectedCustomerName,
  inviteEmail,
  inviteDisplayName,
  inviteRole,
  invitePermissions,
  inviteRoles,
  lastInviteUrl,
  pendingInvites,
  customers,
  formatDate,
  getRoleLabel,
  onInviteEmailChange,
  onInviteDisplayNameChange,
  onInviteRoleChange,
  onInvitePermissionsChange,
  onCreateInvite,
  onDeleteInvite
}: AdminInvitesSectionProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-amber-900">Belangrijk</div>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Er wordt nog geen e-mail automatisch verstuurd. Na het aanmaken moet je de
            activatielink zelf mailen naar de klant.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Nieuwe uitnodiging</h2>
          <p className="mt-1 text-sm text-slate-500">
            Maak een invite aan voor het geselecteerde bedrijf.
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Geselecteerd bedrijf:{" "}
            <span className="font-semibold text-slate-900">{selectedCustomerName}</span>
          </div>

          <form onSubmit={onCreateInvite} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                E-mailadres
              </label>
              <input
                value={inviteEmail}
                onChange={(e) => onInviteEmailChange(e.target.value)}
                placeholder="email@bedrijf.be"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Naam
              </label>
              <input
                value={inviteDisplayName}
                onChange={(e) => onInviteDisplayNameChange(e.target.value)}
                placeholder="Optioneel"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Rol
              </label>
              <select
                value={inviteRole}
                onChange={(e) => onInviteRoleChange(e.target.value)}
                disabled={inviteRoles.length === 0}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-100"
              >
                {inviteRoles.length === 0 ? (
                  <option value="">Geen rollen gevonden</option>
                ) : (
                  inviteRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Extra permissies
              </label>
              <input
                value={invitePermissions}
                onChange={(e) => onInvitePermissionsChange(e.target.value)}
                placeholder="Optioneel, komma-gescheiden"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={inviteRoles.length === 0}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Uitnodiging aanmaken
            </button>
          </form>

          {lastInviteUrl && (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="font-semibold">Activatielink aangemaakt</div>
              <div className="mt-2 break-all">{lastInviteUrl}</div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Openstaande uitnodigingen</h2>
            <p className="mt-2 text-sm text-slate-500">
              Eerst zicht op pending invites. Daarna pas de accepted flow in memberships.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-semibold">E-mail</th>
                <th className="pb-3 pr-4 font-semibold">Bedrijf</th>
                <th className="pb-3 pr-4 font-semibold">Rol</th>
                <th className="pb-3 pr-4 font-semibold">Aangemaakt</th>
                <th className="pb-3 text-right font-semibold">Acties</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((invite) => (
                <tr key={invite.id} className="border-b border-slate-100">
                  <td className="py-4 pr-4 text-slate-900">{invite.email || "-"}</td>
                  <td className="py-4 pr-4 text-slate-600">
                    {customers.find((customer) => customer.id === invite.customerId)?.name ||
                      invite.customerId ||
                      "-"}
                  </td>
                  <td className="py-4 pr-4 text-slate-600">
                    {getRoleLabel(invite.role)}
                  </td>
                  <td className="py-4 pr-4 text-slate-600">
                    {formatDate(invite.createdAt)}
                  </td>
                  <td className="py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteInvite(invite.id, invite.email || "deze uitnodiging")}
                      className="rounded-xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))}

              {pendingInvites.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-slate-500">
                    Geen openstaande uitnodigingen.
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
