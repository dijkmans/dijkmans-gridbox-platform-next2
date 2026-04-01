"use client";

import { FormEvent, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import AuthPanel from "@/components/AuthPanel";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboardSection from "@/components/admin/sections/AdminDashboardSection";
import AdminProvisioningSection from "@/components/admin/sections/AdminProvisioningSection";
import AdminCustomersSection from "@/components/admin/sections/AdminCustomersSection";
import AdminInvitesSection from "@/components/admin/sections/AdminInvitesSection";
import AdminMembershipsSection from "@/components/admin/sections/AdminMembershipsSection";
import AdminRolesSection from "@/components/admin/sections/AdminRolesSection";
import AdminLogsSection from "@/components/admin/sections/AdminLogsSection";
import {
  fetchAdminCustomers,
  fetchAdminMemberships,
  fetchAdminCustomerBoxAccess,
  fetchAdminBoxes,
  fetchAdminInvites,
  fetchAdminRoles,
  postAdminJson,
  deleteAdminPath
} from "@/components/admin/adminApi";
import type {
  ActiveSection,
  CustomerItem,
  MembershipItem,
  InviteItem,
  CustomerBoxAccessItem,
  AdminBoxItem,
  AdminRoleItem
} from "@/components/admin/types";
import {
  getBoxLabel,
  isValidEmail,
  formatDate
} from "@/components/admin/helpers";
import {
  navigationItems,
  provisioningSteps,
  provisioningStepContent,
  getPendingInvites,
  getCustomerSummaries,
  getSiteSummaries,
  getAdminRoleLabel as getDerivedAdminRoleLabel,
  getActiveCustomersCount,
  getActiveAccessCount,
  getCustomerMembers,
  getCustomerInvites,
  getCustomerAccess,
  getSelectedCustomer
} from "@/components/admin/derived";


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
        fetchAdminCustomers({ token }),
        fetchAdminMemberships({ token }),
        fetchAdminCustomerBoxAccess({ token }),
        fetchAdminBoxes({ token }),
        fetchAdminInvites({ token }).catch(
          () => ({ ok: false, json: async () => ({ items: [] }) } as any)
        ),
        fetchAdminRoles({ token }).catch(
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
    const res = await postAdminJson(url, {
      token,
      body
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

    const result = await postJson("/admin/customers", {
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

    const result = await postJson("/admin/invites", body);
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

    const result = await postJson("/admin/customer-box-access", {
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
        `/admin/customers/${encodeURIComponent(customerId)}/status`,
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
        `/admin/customer-box-access/${encodeURIComponent(accessId)}/status`,
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
    const res = await deleteAdminPath(`/admin/invites/${encodeURIComponent(inviteId)}`, {
      token
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
    const res = await deleteAdminPath(`/admin/memberships/${encodeURIComponent(membershipId)}`, {
      token
    });

    const data = await res.json();
    if (!res.ok) {
      return setErrorMessage(data.message || "Verwijderen van persoon mislukt");
    }

    setSuccessMessage("Persoon verwijderd");
    await loadAdminData(false);
  }

  const selectedCustomer = getSelectedCustomer(customers, selectedCustomerId);
  const customerMembers = getCustomerMembers(memberships, selectedCustomerId);
  const customerInvites = getCustomerInvites(invites, selectedCustomerId);
  const customerAccess = getCustomerAccess(customerBoxAccess, selectedCustomerId);

  const activeCustomersCount = getActiveCustomersCount(customers);
  const membershipCount = memberships.length;
  const pendingInvites = getPendingInvites(invites);
  const pendingInviteCount = pendingInvites.length;
  const activeAccessCount = getActiveAccessCount(customerBoxAccess);

  const siteSummaries = getSiteSummaries(boxes);
  const customerSummaries = getCustomerSummaries(customers, memberships, customerBoxAccess);

  const getAdminRoleLabel = (roleId: string | undefined) =>
    getDerivedAdminRoleLabel(roleId, inviteRoles);

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
              <AdminRolesSection
                roles={inviteRoles}
              />
            )}
{activeSection === "logs" && (
              <AdminLogsSection />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}













