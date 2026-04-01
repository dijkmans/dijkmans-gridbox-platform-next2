"use client";

import { FormEvent, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";
import AuthPanel from "@/components/AuthPanel";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboardSection from "@/components/admin/sections/AdminDashboardSection";
import AdminProvisioningSection from "@/components/admin/sections/AdminProvisioningSection";
import AdminCustomersSection from "@/components/admin/sections/AdminCustomersSection";
import AdminInvitesSection from "@/components/admin/sections/AdminInvitesSection";
import AdminMembershipsSection from "@/components/admin/sections/AdminMembershipsSection";

type CustomerItem = {
  id: string;
  name?: string;
  active?: boolean;
  createdAt?: string;
  addedBy?: string;
};

type MembershipItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
};

type InviteItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
  status?: string;
  createdAt?: string;
};

type CustomerBoxAccessItem = {
  id: string;
  customerId?: string;
  boxId?: string;
  active?: boolean;
  createdAt?: string;
  addedBy?: string;
};

type AdminBoxItem = {
  id: string;
  boxId?: string;
  siteId?: string | null;
  customerId?: string | null;
  updatedAt?: string | null;
};

type AdminRoleItem = {
  id: string;
  label: string;
  active?: boolean;
  assignableInAdmin?: boolean;
};

type ActiveSection =
  | "dashboard"
  | "provisioning"
  | "customers"
  | "sites"
  | "boxes"
  | "invites"
  | "memberships"
  | "roles"
  | "logs";

function getBoxLabel(box: AdminBoxItem) {
  const id = box.boxId || box.id;
  const site = box.siteId || "geen-site";
  return `${id} (${site})`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("nl-BE");
}

function getRoleLabel(roleId: string | undefined, roles: AdminRoleItem[]) {
  if (!roleId) return "-";
  return roles.find((role) => role.id === roleId)?.label || roleId;
}

export default function AdminPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [customerBoxAccess, setCustomerBoxAccess] = useState<CustomerBoxAccessItem[]>([]);
  const [boxes, setBoxes] = useState<AdminBoxItem[]>([]);
  const [inviteRoles, setInviteRoles] = useState<AdminRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [selectedProvisioningStep, setSelectedProvisioningStep] = useState(0);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [newCustomerId, setNewCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState("customerViewer");
  const [invitePermissions, setInvitePermissions] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState("");

  const [accessBoxId, setAccessBoxId] = useState("");

  const sortedBoxes = [...boxes].sort((a, b) => getBoxLabel(a).localeCompare(getBoxLabel(b)));

  async function loadAdminData(clearFeedback = false) {
    try {
      setLoading(true);
      if (clearFeedback) {
        setErrorMessage("");
        setSuccessMessage("");
      }

      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("Meld je aan om admingegevens te bekijken");
        return;
      }

      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [
        customersRes,
        membershipsRes,
        customerBoxAccessRes,
        boxesRes,
        invitesRes,
        rolesRes
      ] = await Promise.all([
        fetch(apiUrl("/admin/customers"), { headers }),
        fetch(apiUrl("/admin/memberships"), { headers }),
        fetch(apiUrl("/admin/customer-box-access"), { headers }),
        fetch(apiUrl("/admin/boxes"), { headers }),
        fetch(apiUrl("/admin/invites"), { headers }).catch(
          () => ({ ok: false, json: async () => ({ items: [] }) } as any)
        ),
        fetch(apiUrl("/admin/roles"), { headers }).catch(
          () => ({ ok: false, json: async () => ({ items: [] }) } as any)
        )
      ]);

      const [
        customersData,
        membershipsData,
        accessData,
        boxesData,
        invitesData,
        rolesData
      ] = await Promise.all([
        customersRes.json(),
        membershipsRes.json(),
        customerBoxAccessRes.json(),
        boxesRes.json(),
        invitesRes.ok ? invitesRes.json() : { items: [] },
        rolesRes.ok ? rolesRes.json() : { items: [] }
      ]);

      const nextCustomers: CustomerItem[] = customersData.items || [];
      const nextRoles: AdminRoleItem[] = rolesData.items || [];
      const defaultInviteRole =
        nextRoles.find((role) => role.id === "customerViewer")?.id ||
        nextRoles[0]?.id ||
        "";

      setCustomers(nextCustomers);
      setMemberships(membershipsData.items || []);
      setCustomerBoxAccess(accessData.items || []);
      setBoxes(boxesData.items || []);
      setInvites(invitesData.items || []);
      setInviteRoles(nextRoles);
      setInviteRole((current) =>
        nextRoles.some((role) => role.id === current) ? current : defaultInviteRole
      );
      setSelectedCustomerId((current) =>
        current && nextCustomers.some((customer) => customer.id === current)
          ? current
          : nextCustomers[0]?.id || null
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Netwerkfout bij ophalen admingegevens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const unsubscribe = auth.onAuthStateChanged(async () => {
      if (active) await loadAdminData();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function postJson(url: string, body: object) {
    const user = auth.currentUser;
    setErrorMessage("");
    setSuccessMessage("");
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return null;
    }

    const token = await user.getIdToken();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      setErrorMessage(data.message || "Opslaan mislukt");
      return null;
    }

    return data;
  }

  async function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();
    const customerId = newCustomerId.trim();
    const customerName = newCustomerName.trim();

    if (!customerId || !customerName) {
      return setErrorMessage("ID en naam zijn verplicht");
    }

    const result = await postJson(apiUrl("/admin/customers"), {
      id: customerId,
      name: customerName
    });

    if (result) {
      setNewCustomerId("");
      setNewCustomerName("");
      setSuccessMessage("Bedrijf opgeslagen");
      await loadAdminData(false);
    }
  }

  async function handleCreateInvite(e: FormEvent) {
    e.preventDefault();

    if (!selectedCustomerId) {
      return setErrorMessage("Kies eerst een bedrijf");
    }

    if (!inviteRole) {
      return setErrorMessage("Geen geldige rol beschikbaar");
    }

    const email = inviteEmail.trim();
    if (!isValidEmail(email)) {
      return setErrorMessage("Vul een geldig e-mailadres in");
    }

    const permissions = invitePermissions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const body = {
      email,
      displayName: inviteDisplayName || undefined,
      customerId: selectedCustomerId,
      role: inviteRole,
      scope: permissions.length > 0 ? { permissions } : {}
    };

    const result = await postJson(apiUrl("/admin/invites"), body);
    if (result) {
      const defaultInviteRole =
        inviteRoles.find((role) => role.id === "customerViewer")?.id ||
        inviteRoles[0]?.id ||
        "";

      setInviteEmail("");
      setInviteDisplayName("");
      setInviteRole(defaultInviteRole);
      setInvitePermissions("");
      setLastInviteUrl(result.inviteUrl || "");
      setSuccessMessage("Uitnodiging aangemaakt. Mail zelf de activatielink naar de klant.");
      await loadAdminData(false);
    }
  }

  async function handleCreateAccess(e: FormEvent) {
    e.preventDefault();

    if (!selectedCustomerId) return;
    if (!accessBoxId) {
      return setErrorMessage("Kies een box");
    }

    const result = await postJson(apiUrl("/admin/customer-box-access"), {
      customerId: selectedCustomerId,
      boxId: accessBoxId
    });

    if (result) {
      setAccessBoxId("");
      setSuccessMessage("Box toegewezen");
      await loadAdminData(false);
    }
  }

  async function handleSetCustomerStatus(customerId: string, active: boolean) {
    if (
      await postJson(
        apiUrl(`/admin/customers/${encodeURIComponent(customerId)}/status`),
        { active }
      )
    ) {
      setSuccessMessage(`Bedrijf ${active ? "geactiveerd" : "gedeactiveerd"}`);
      await loadAdminData(false);
    }
  }

  async function handleSetAccessStatus(accessId: string, active: boolean) {
    if (
      await postJson(
        apiUrl(`/admin/customer-box-access/${encodeURIComponent(accessId)}/status`),
        { active }
      )
    ) {
      setSuccessMessage(`Box-toegang ${active ? "geactiveerd" : "gedeactiveerd"}`);
      await loadAdminData(false);
    }
  }

  async function handleDeleteInvite(inviteId: string, email: string) {
    if (!window.confirm(`Ben je zeker dat je de uitnodiging voor ${email} wilt verwijderen?`)) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      return setErrorMessage("Niet aangemeld");
    }

    setErrorMessage("");
    setSuccessMessage("");

    const token = await user.getIdToken();
    const res = await fetch(apiUrl(`/admin/invites/${encodeURIComponent(inviteId)}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) {
      return setErrorMessage(data.message || "Verwijderen van uitnodiging mislukt");
    }

    setSuccessMessage("Uitnodiging verwijderd");
    await loadAdminData(false);
  }

  async function handleDeleteMembership(membershipId: string, email: string) {
    if (!window.confirm(`Ben je zeker dat je ${email} wilt verwijderen uit dit bedrijf?`)) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      return setErrorMessage("Niet aangemeld");
    }

    setErrorMessage("");
    setSuccessMessage("");

    const token = await user.getIdToken();
    const res = await fetch(apiUrl(`/admin/memberships/${encodeURIComponent(membershipId)}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) {
      return setErrorMessage(data.message || "Verwijderen van persoon mislukt");
    }

    setSuccessMessage("Persoon verwijderd");
    await loadAdminData(false);
  }

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const customerMembers = memberships.filter((member) => member.customerId === selectedCustomerId);
  const customerInvites = invites.filter(
    (invite) => invite.customerId === selectedCustomerId && invite.status === "pending"
  );
  const customerAccess = customerBoxAccess.filter(
    (access) => access.customerId === selectedCustomerId
  );

  const activeCustomersCount = customers.filter((customer) => customer.active !== false).length;
  const membershipCount = memberships.length;
  const pendingInviteCount = invites.filter((invite) => invite.status === "pending").length;
  const activeAccessCount = customerBoxAccess.filter((access) => access.active !== false).length;

  const siteSummaryMap = new Map<
    string,
    { siteId: string; boxCount: number; customerIds: Set<string> }
  >();

  boxes.forEach((box) => {
    const siteId = box.siteId || "geen-site";
    const existing = siteSummaryMap.get(siteId) || {
      siteId,
      boxCount: 0,
      customerIds: new Set<string>()
    };

    existing.boxCount += 1;
    if (box.customerId) {
      existing.customerIds.add(box.customerId);
    }

    siteSummaryMap.set(siteId, existing);
  });

  const siteSummaries = Array.from(siteSummaryMap.values()).sort((a, b) =>
    a.siteId.localeCompare(b.siteId)
  );

  const customerSummaries = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    active: customer.active,
    memberCount: memberships.filter((membership) => membership.customerId === customer.id).length,
    accessCount: customerBoxAccess.filter((access) => access.customerId === customer.id).length
  }));
  const navigationItems: Array<{ id: ActiveSection; label: string }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "provisioning", label: "Installatiecockpit" },
    { id: "customers", label: "Klanten" },
    { id: "sites", label: "Sites" },
    { id: "boxes", label: "Boxen" },
    { id: "invites", label: "Uitnodigingen" },
    { id: "memberships", label: "Gebruikerstoegang" },
    { id: "roles", label: "Rollen en rechten" },
    { id: "logs", label: "Provisioning logs" }
  ];

  const pendingInvites = invites.filter((invite) => invite.status === "pending");

  const getAdminRoleLabel = (roleId: string | undefined) => getRoleLabel(roleId, inviteRoles);
  const provisioningSteps = [
    "Nieuwe box voorbereiden",
    "Installatievoorbereiding aanmaken",
    "SD-kaart klaarleggen",
    "Imager instellingen",
    "Opstartbestanden",
    "Eerste opstart",
    "Live controle"
  ];

  const provisioningStepContent = [
    {
      title: "Nieuwe box voorbereiden",
      text:
        "Hier hoort straks de eerste stap van de wizard te komen. Box ID, klant en site moeten hier bewust gekozen worden. Niet terug naar losse locatievelden op boxniveau."
    },
    {
      title: "Installatievoorbereiding aanmaken",
      text:
        "Deze stap moet later een backend-call worden die een provisioningrecord en beperkte bootstrapinfo aanmaakt. Niet in de frontend zelf verzinnen."
    },
    {
      title: "SD-kaart klaarleggen",
      text:
        "Wout moet hier maar één fysieke taak tegelijk zien. Geen technische chaos, gewoon duidelijke checkstappen."
    },
    {
      title: "Imager instellingen",
      text:
        "Hostname, gebruiker, wachtwoord, SSH en OS-keuze moeten zichtbaar op het scherm staan. Niets uit het hoofd laten onthouden."
    },
    {
      title: "Opstartbestanden",
      text:
        "De richting blijft beperkt bootstrapmateriaal. Geen brede secrets als standaard op de SD-kaart."
    },
    {
      title: "Eerste opstart",
      text:
        "Deze stap moet later live tonen wanneer de Pi zichzelf claimt en voor het eerst online komt."
    },
    {
      title: "Live controle",
      text:
        "Pas wanneer backend en device dit echt bevestigen, mag een installatie als klaar getoond worden."
    }
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-[1700px]">
        <AdminSidebar
          activeSection={activeSection}
          navigationItems={navigationItems}
          onSectionChange={setActiveSection}
        />

        <div className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Platformbeheer
                </div>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Gridbox Admin</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Huidige werkende admin met eerste nieuwe structuur.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection("provisioning")}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                >
                  + Nieuwe Gridbox installeren
                </button>
                <button
                  type="button"
                  onClick={() => loadAdminData(true)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ververs
                </button>
                <AuthPanel />
              </div>
            </div>

            {errorMessage && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            {loading && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
                Admingegevens worden geladen...
              </div>
            )}

            {activeSection === "dashboard" && (
              <AdminDashboardSection
                activeCustomersCount={activeCustomersCount}
                totalCustomersCount={customers.length}
                membershipCount={membershipCount}
                pendingInviteCount={pendingInviteCount}
                activeAccessCount={activeAccessCount}
                onSectionChange={setActiveSection}
              />
            )}
{activeSection === "provisioning" && (
              <AdminProvisioningSection
                selectedProvisioningStep={selectedProvisioningStep}
                provisioningSteps={provisioningSteps}
                provisioningStepContent={provisioningStepContent}
                onStepChange={setSelectedProvisioningStep}
              />
            )}
{activeSection === "customers" && (
              <AdminCustomersSection
                customers={customerSummaries}
                selectedCustomerId={selectedCustomerId}
                selectedCustomer={selectedCustomer ?? null}
                customerMemberCount={customerMembers.length}
                customerInviteCount={customerInvites.length}
                customerAccessCount={customerAccess.length}
                newCustomerId={newCustomerId}
                newCustomerName={newCustomerName}
                onSelectCustomer={setSelectedCustomerId}
                onNewCustomerIdChange={setNewCustomerId}
                onNewCustomerNameChange={setNewCustomerName}
                onCreateCustomer={handleCreateCustomer}
                onToggleCustomerStatus={handleSetCustomerStatus}
              />
            )}
{activeSection === "sites" && (
              <section className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-900">Sites</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    In deze slice is er nog geen volwaardig sitescherm met eigen endpoint en adresdata.
                    Wat je hier al wel ziet, zijn de siteverwijzingen die vandaag in de boxdata zitten.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="pb-3 pr-4 font-semibold">Site ID</th>
                          <th className="pb-3 pr-4 font-semibold">Aantal boxen</th>
                          <th className="pb-3 pr-4 font-semibold">Aantal klanten</th>
                        </tr>
                      </thead>
                      <tbody>
                        {siteSummaries.map((site) => (
                          <tr key={site.siteId} className="border-b border-slate-100">
                            <td className="py-4 pr-4 font-semibold text-slate-900">{site.siteId}</td>
                            <td className="py-4 pr-4 text-slate-600">{site.boxCount}</td>
                            <td className="py-4 pr-4 text-slate-600">{site.customerIds.size}</td>
                          </tr>
                        ))}

                        {siteSummaries.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-6 text-slate-500">
                              Nog geen siteverwijzingen gevonden in de geladen boxen.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeSection === "boxes" && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Boxen</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Overzicht van de boxen die vandaag al in admin opgehaald worden.
                    </p>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Box</th>
                        <th className="pb-3 pr-4 font-semibold">Site</th>
                        <th className="pb-3 pr-4 font-semibold">Klant</th>
                        <th className="pb-3 pr-4 font-semibold">Laatste update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBoxes.map((box) => (
                        <tr key={box.id} className="border-b border-slate-100">
                          <td className="py-4 pr-4 font-semibold text-slate-900">
                            {box.boxId || box.id}
                          </td>
                          <td className="py-4 pr-4 text-slate-600">{box.siteId || "-"}</td>
                          <td className="py-4 pr-4 text-slate-600">{box.customerId || "-"}</td>
                          <td className="py-4 pr-4 text-slate-600">{formatDate(box.updatedAt)}</td>
                        </tr>
                      ))}

                      {sortedBoxes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-slate-500">
                            Nog geen boxen gevonden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeSection === "invites" && (
              <AdminInvitesSection
                selectedCustomerName={selectedCustomer?.name || selectedCustomer?.id || "geen"}
                inviteEmail={inviteEmail}
                inviteDisplayName={inviteDisplayName}
                inviteRole={inviteRole}
                invitePermissions={invitePermissions}
                inviteRoles={inviteRoles}
                lastInviteUrl={lastInviteUrl}
                pendingInvites={pendingInvites}
                customers={customers}
                formatDate={formatDate}
                getRoleLabel={getAdminRoleLabel}
                onInviteEmailChange={setInviteEmail}
                onInviteDisplayNameChange={setInviteDisplayName}
                onInviteRoleChange={setInviteRole}
                onInvitePermissionsChange={setInvitePermissions}
                onCreateInvite={handleCreateInvite}
                onDeleteInvite={handleDeleteInvite}
              />
            )}
{activeSection === "memberships" && (
              <AdminMembershipsSection
                selectedCustomerName={selectedCustomer?.name || selectedCustomer?.id || "geen"}
                customerMemberCount={customerMembers.length}
                customerAccessCount={customerAccess.length}
                accessBoxId={accessBoxId}
                sortedBoxes={sortedBoxes}
                memberships={memberships}
                customers={customers}
                customerAccess={customerAccess}
                getRoleLabel={getAdminRoleLabel}
                getBoxLabel={getBoxLabel}
                onAccessBoxIdChange={setAccessBoxId}
                onCreateAccess={handleCreateAccess}
                onDeleteMembership={handleDeleteMembership}
                onToggleAccessStatus={handleSetAccessStatus}
              />
            )}
{activeSection === "roles" && (
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
                      {inviteRoles.map((role) => (
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

                      {inviteRoles.length === 0 && (
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
            )}

            {activeSection === "logs" && (
              <section className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-900">Provisioning logs</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    Dit scherm is in slice 1 nog bewust een placeholder. Eerst de structuur recht,
                    daarna pas de echte provisioning- en logkoppeling.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
                    Nog niet aangesloten in deze pagina:
                    <br />
                    - echte provisioningstatussen
                    <br />
                    - device claim en heartbeat
                    <br />
                    - foutdetails per installatie
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}






