"use client";

type RoleListItem = {
  id: string;
  label: string;
  active?: boolean;
  assignableInAdmin?: boolean;
};

type AdminRolesSectionProps = {
  roles: RoleListItem[];
};

export default function AdminRolesSection({ roles }: AdminRolesSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rollen en rechten</h2>
          <p className="mt-2 text-sm text-slate-500">
            Gebruiksvriendelijke labels in de admin, technische role ids onder water.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="pb-3 pr-4 font-semibold">Technische rol</th>
              <th className="pb-3 pr-4 font-semibold">Label</th>
              <th className="pb-3 pr-4 font-semibold">Actief</th>
              <th className="pb-3 pr-4 font-semibold">Kiesbaar in admin</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-slate-100">
                <td className="py-4 pr-4 font-semibold text-slate-900">{role.id}</td>
                <td className="py-4 pr-4 text-slate-600">{role.label}</td>
                <td className="py-4 pr-4 text-slate-600">
                  {role.active === false ? "Nee" : "Ja"}
                </td>
                <td className="py-4 pr-4 text-slate-600">
                  {role.assignableInAdmin === false ? "Nee" : "Ja"}
                </td>
              </tr>
            ))}

            {roles.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-slate-500">
                  Geen rollen gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
