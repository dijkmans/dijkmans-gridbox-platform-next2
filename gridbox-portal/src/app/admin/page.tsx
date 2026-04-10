"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  fetchAdminSites,
  fetchAdminInvites,
  fetchAdminRoles,
  fetchAdminProvisionings,
  deleteAdminProvisioning,
  fetchAdminPath,
  fetchAdminSuggestBoxId,
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
  AdminSiteItem,
  AdminRoleItem,
  AdminProvisioningItem,
  AdminProvisioningStatus
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
  const router = useRouter();
  const urlProvisioningProcessedRef = useRef(false);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [customerBoxAccess, setCustomerBoxAccess] = useState<CustomerBoxAccessItem[]>([]);
  const [boxes, setBoxes] = useState<AdminBoxItem[]>([]);
  const [sites, setSites] = useState<AdminSiteItem[]>([]);
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

  const [provisioningCustomerId, setProvisioningCustomerId] = useState("");
  const [provisioningSiteId, setProvisioningSiteId] = useState("");
  const [provisioningBoxId, setProvisioningBoxId] = useState("");
  const [provisioningItem, setProvisioningItem] = useState<AdminProvisioningItem | null>(null);
  const [provisioningItems, setProvisioningItems] = useState<AdminProvisioningItem[]>([]);
  const [provisioningLookupId, setProvisioningLookupId] = useState("");
  const [provisioningBusy, setProvisioningBusy] = useState(false);
  const [bootstrapDownloadItem, setBootstrapDownloadItem] = useState<Record<string, string> | null>(null);

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

      const [
        customersRes,
        membershipsRes,
        customerBoxAccessRes,
        boxesRes,
        sitesRes,
        invitesRes,
        rolesRes,
        provisioningsRes
      ] = await Promise.all([
        fetchAdminCustomers({ token }),
        fetchAdminMemberships({ token }),
        fetchAdminCustomerBoxAccess({ token }),
        fetchAdminBoxes({ token }),
        fetchAdminSites({ token }),
        fetchAdminInvites({ token }).catch(
          () => ({ ok: false, json: async () => ({ items: [] }) } as any)
        ),
        fetchAdminRoles({ token }).catch(
          () => ({ ok: false, json: async () => ({ items: [] }) } as any)
        ),
        fetchAdminProvisionings({ token }).catch(
          () => ({ ok: false, json: async () => ({ items: [] }) } as any)
        )
      ]);

      const [
        customersData,
        membershipsData,
        accessData,
        boxesData,
        sitesData,
        invitesData,
        rolesData,
        provisioningsData
      ] = await Promise.all([
        customersRes.json(),
        membershipsRes.json(),
        customerBoxAccessRes.json(),
        boxesRes.json(),
        sitesRes.json(),
        invitesRes.ok ? invitesRes.json() : { items: [] },
        rolesRes.ok ? rolesRes.json() : { items: [] },
        provisioningsRes.ok ? provisioningsRes.json() : { items: [] }
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
      setSites(sitesData.items || []);
      setInvites(invitesData.items || []);
      setProvisioningItems(provisioningsData.items || []);
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

  // Auto-load provisioning from URL param after initial data load
  useEffect(() => {
    if (loading) return;
    if (urlProvisioningProcessedRef.current) return;
    const id = new URLSearchParams(window.location.search).get("provisioning");
    if (!id) return;
    urlProvisioningProcessedRef.current = true;
    fetchProvisioningById(id).then((item) => {
      if (item) setActiveSection("provisioning");
    });
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectProvisioning(id: string) {
    router.push(`/admin?provisioning=${encodeURIComponent(id)}`);
    setActiveSection("provisioning");
    fetchProvisioningById(id);
  }

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

  function normalizeProvisioningItem(input: unknown): AdminProvisioningItem | null {
    if (!input || typeof input !== "object") {
      return null;
    }

    const source = input as Record<string, unknown>;

    return {
      id: typeof source.id === "string" ? source.id : "",
      customerId: typeof source.customerId === "string" ? source.customerId : null,
      siteId: typeof source.siteId === "string" ? source.siteId : null,
      boxId: typeof source.boxId === "string" ? source.boxId : null,
      status: typeof source.status === "string" ? source.status : undefined,
      createdAt: typeof source.createdAt === "string" ? source.createdAt : null,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
      claimedAt: typeof source.claimedAt === "string" ? source.claimedAt : null,
      claimedByDevice:
        typeof source.claimedByDevice === "string" ? source.claimedByDevice : null,
      lastHeartbeatAt:
        typeof source.lastHeartbeatAt === "string" ? source.lastHeartbeatAt : null,
      finalizedAt: typeof source.finalizedAt === "string" ? source.finalizedAt : null,
      finalizedBy: typeof source.finalizedBy === "string" ? source.finalizedBy : null,
      listenerVersion: typeof source.listenerVersion === "string" ? source.listenerVersion : null,
      i2cStatus: typeof source.i2cStatus === "string" ? source.i2cStatus : null,
    };
  }

  async function fetchProvisioningById(provisioningId: string) {
    const trimmedProvisioningId = provisioningId.trim();

    if (!trimmedProvisioningId) {
      setErrorMessage("Provisioning ID is verplicht");
      return null;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return null;
    }

    setProvisioningBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await fetchAdminPath(
        `/admin/provisioning/${encodeURIComponent(trimmedProvisioningId)}`,
        { token }
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Kon provisioning niet ophalen");
        return null;
      }

      const nextProvisioningItem = normalizeProvisioningItem(
        data.item || data.provisioning
      );
      if (!nextProvisioningItem?.id) {
        setErrorMessage("Backend gaf geen geldige provisioning terug");
        return null;
      }

      setProvisioningItem(nextProvisioningItem);
      setProvisioningLookupId(nextProvisioningItem.id);
      if (nextProvisioningItem.boxId) {
        setProvisioningBoxId(nextProvisioningItem.boxId);
      }
      return nextProvisioningItem;
    } catch (error) {
      setErrorMessage("Netwerkfout bij ophalen provisioning");
      return null;
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handleCreateProvisioning() {
    const customerId = provisioningCustomerId.trim();
    const siteId = provisioningSiteId.trim();
    const boxId = provisioningBoxId.trim().toLowerCase();

    if (!customerId) {
      setErrorMessage("Kies eerst een klant voor de provisioning");
      return;
    }

    if (!siteId) {
      setErrorMessage("Kies eerst een site voor de provisioning");
      return;
    }

    if (!boxId) {
      setErrorMessage("Vul eerst een geldige box-ID in");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return;
    }

    setProvisioningBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await postAdminJson("/admin/provisioning/boxes", {
        token,
        body: {
          boxId,
          customerId,
          siteId
        }
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Kon provisioning niet aanmaken");

        const existingProvisioningId =
          typeof data.provisioningId === "string" ? data.provisioningId : typeof data.provisioning?.id === "string" ? data.provisioning.id : "";

        if (existingProvisioningId) {
          setProvisioningLookupId(existingProvisioningId);
        }
        return;
      }

      const nextProvisioningItem = normalizeProvisioningItem(
        data.item || data.provisioning
      );
      if (!nextProvisioningItem?.id) {
        setErrorMessage("Backend gaf geen geldige provisioning terug");
        return;
      }

      setProvisioningItem(nextProvisioningItem);
      setProvisioningLookupId(nextProvisioningItem.id);
      setProvisioningBoxId(boxId);
      setSelectedProvisioningStep(1);
      setSuccessMessage("Provisioningrecord aangemaakt");
      await loadAdminData(false);
    } catch (error) {
      setErrorMessage("Netwerkfout bij aanmaken provisioning");
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handlePrepareBootstrapDownload() {
    const provisioningId = provisioningItem?.id?.trim() || provisioningLookupId.trim();

    if (!provisioningId) {
      setErrorMessage("Geen provisioning geselecteerd voor bootstrap-download");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return;
    }

    setProvisioningBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await postAdminJson(
        `/admin/provisioning/${encodeURIComponent(provisioningId)}/bootstrap-download`,
        {
          token,
          body: {}
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Kon bootstrap-download niet voorbereiden");
        return;
      }

      const nextBootstrapItem =
        data.item && typeof data.item === "object"
          ? (data.item as Record<string, string>)
          : null;

      if (!nextBootstrapItem?.provisioningId || !nextBootstrapItem?.bootstrapToken) {
        setErrorMessage("Backend gaf geen geldige bootstrap-download terug");
        return;
      }

      setBootstrapDownloadItem(nextBootstrapItem);
      setSuccessMessage("Bootstrap-download voorbereid");
      await fetchProvisioningById(provisioningId);
    } catch (error) {
      setErrorMessage("Netwerkfout bij voorbereiden bootstrap-download");
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handleGenerateScript() {
    const provisioningId = provisioningItem?.id?.trim() || provisioningLookupId.trim();

    if (!provisioningId) {
      setErrorMessage("Geen provisioning geselecteerd voor script-generatie");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return;
    }

    setProvisioningBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await fetch(
        (await import("@/lib/api")).apiUrl(
          `/admin/provisioning/${encodeURIComponent(provisioningId)}/generate-script`
        ),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage((data as any).message || "Script genereren mislukt");
        return;
      }

      const blob = await res.blob();
      const boxId = provisioningItem?.boxId || provisioningBoxId.trim().toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gridbox-sd-${boxId}.bat`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccessMessage("SD-script gedownload");
      await fetchProvisioningById(provisioningId);
    } catch (error) {
      setErrorMessage("Netwerkfout bij genereren script");
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handleMarkSdPrepared() {
    const provisioningId = provisioningItem?.id?.trim() || provisioningLookupId.trim();

    if (!provisioningId) {
      setErrorMessage("Geen provisioning geselecteerd om SD-kaart als klaar te markeren");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return;
    }

    setProvisioningBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await postAdminJson(
        `/admin/provisioning/${encodeURIComponent(provisioningId)}/mark-sd-prepared`,
        {
          token,
          body: {}
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Kon SD-kaartstatus niet opslaan");
        return;
      }

      await fetchProvisioningById(provisioningId);
      setSelectedProvisioningStep(5);
      setSuccessMessage("SD-kaart als klaar gemarkeerd");
      await loadAdminData(false);
    } catch (error) {
      setErrorMessage("Netwerkfout bij opslaan SD-kaartstatus");
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handleDeleteProvisioning(id: string) {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const res = await deleteAdminProvisioning(id, { token });
    if (res.ok) {
      setProvisioningItems((prev) => prev.filter((item) => item.id !== id));
      setSuccessMessage("Provisioning verwijderd");
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMessage(data.message || "Verwijderen mislukt");
    }
  }

  async function handleSuggestBoxId(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    return fetchAdminSuggestBoxId({ token });
  }

  async function handleRefreshProvisioning() {
    const provisioningId =
      provisioningLookupId.trim() || provisioningItem?.id?.trim() || "";

    const refreshedItem = await fetchProvisioningById(provisioningId);
    if (refreshedItem) {
      setSuccessMessage("Provisioning opnieuw opgehaald");
    }
  }

  async function handleFinalizeProvisioning() {
    const provisioningId = provisioningItem?.id?.trim() || provisioningLookupId.trim();

    if (!provisioningId) {
      setErrorMessage("Geen provisioning geselecteerd om af te ronden");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return;
    }

    setProvisioningBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await postAdminJson(
        `/admin/provisioning/${encodeURIComponent(provisioningId)}/finalize`,
        {
          token,
          body: {}
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Kon provisioning niet afronden");
        return;
      }

      await fetchProvisioningById(provisioningId);
      setSuccessMessage("Provisioning afgerond");
      await loadAdminData(false);
    } catch (error) {
      setErrorMessage("Netwerkfout bij afronden provisioning");
    } finally {
      setProvisioningBusy(false);
    }
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

  const boxBasedSiteSummaries = getSiteSummaries(boxes);
  const siteSummaries =
    sites.length > 0
      ? sites
          .map((site) => ({
            siteId: site.id,
            boxCount: boxes.filter((box) => box.siteId === site.id).length,
            customerIds: new Set(site.customerId ? [site.customerId] : [])
          }))
          .sort((a, b) => a.siteId.localeCompare(b.siteId))
      : boxBasedSiteSummaries;

  const provisioningSiteSummaries = sites
    .map((site) => ({
      siteId: site.id,
      boxCount: boxes.filter((box) => box.siteId === site.id).length,
      customerIds: new Set(site.customerId ? [site.customerId.toLowerCase()] : [])
    }))
    .sort((a, b) => a.siteId.localeCompare(b.siteId));
  const customerSummaries = getCustomerSummaries(customers, memberships, customerBoxAccess);

  const getAdminRoleLabel = (roleId: string | undefined) =>
    getDerivedAdminRoleLabel(roleId, inviteRoles);

  const provisioningStatusLabels: Record<AdminProvisioningStatus, string> = {
    draft: "Draft",
    awaiting_first_boot: "Wacht op eerste opstart",
    claimed: "Geclaimd",
    online: "Online",
    ready: "Klaar",
    failed: "Mislukt"
  };

  const provisioningStatus =
    provisioningItem?.status &&
    Object.prototype.hasOwnProperty.call(provisioningStatusLabels, provisioningItem.status)
      ? (provisioningItem.status as AdminProvisioningStatus)
      : null;

  const provisioningStatusLabel = provisioningStatus
    ? provisioningStatusLabels[provisioningStatus]
    : provisioningItem?.status || "Nog geen provisioning geladen";

  const canFinalizeProvisioning =
    (provisioningStatus === "online" || provisioningStatus === "ready") &&
    !provisioningBusy;
  const canRefreshProvisioning =
    !provisioningBusy &&
    (provisioningLookupId.trim().length > 0 || Boolean(provisioningItem?.id));
  const provisioningCustomerLabel =
    customers.find((customer) => customer.id === provisioningItem?.customerId)?.name ||
    provisioningItem?.customerId ||
    "-";

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
              <div className="flex flex-wrap items-center gap-3">
                {activeSection !== "provisioning" && (
                  <button
                    type="button"
                    onClick={() => setActiveSection("provisioning")}
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    + Nieuwe Gridbox installeren
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => loadAdminData(true)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ververs
                </button>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <AuthPanel />
                </div>
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
              <section>
                <AdminProvisioningSection
                  selectedProvisioningStep={selectedProvisioningStep}
                  provisioningSteps={provisioningSteps}
                  provisioningStepContent={provisioningStepContent}
                  customers={customers}
                  siteSummaries={provisioningSiteSummaries}
                  boxes={boxes}
                  provisioningCustomerId={provisioningCustomerId}
                  provisioningSiteId={provisioningSiteId}
                  provisioningBoxId={provisioningBoxId}
                  provisioningItem={provisioningItem}
                  provisioningLookupId={provisioningLookupId}
                  provisioningBusy={provisioningBusy}
                  provisioningStatusLabel={provisioningStatusLabel}
                  canRefreshProvisioning={canRefreshProvisioning}
                  canFinalizeProvisioning={canFinalizeProvisioning}
                  onProvisioningCustomerChange={setProvisioningCustomerId}
                  onProvisioningSiteChange={setProvisioningSiteId}
                  onProvisioningBoxIdChange={setProvisioningBoxId}
                  onProvisioningLookupIdChange={setProvisioningLookupId}
                  onCreateProvisioning={handleCreateProvisioning}
                  onRefreshProvisioning={handleRefreshProvisioning}
                  onFinalizeProvisioning={handleFinalizeProvisioning}
                  bootstrapDownloadItem={bootstrapDownloadItem}
                  onPrepareBootstrapDownload={handlePrepareBootstrapDownload}
                  onGenerateScript={handleGenerateScript}
                  onMarkSdPrepared={handleMarkSdPrepared}
                  onStepChange={setSelectedProvisioningStep}
                  onSuggestBoxId={handleSuggestBoxId}
                />
              </section>
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
                selectedCustomerId={selectedCustomerId}
                selectedCustomerName={selectedCustomer?.name || selectedCustomer?.id || "geen"}
                onSelectCustomer={setSelectedCustomerId}
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
                memberships={customerMembers}
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
              <AdminLogsSection
                provisioningItems={provisioningItems}
                customers={customers}
                provisioningStatusLabels={provisioningStatusLabels}
                formatDate={formatDate}
                onDeleteProvisioning={handleDeleteProvisioning}
                onSelectProvisioning={handleSelectProvisioning}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}















