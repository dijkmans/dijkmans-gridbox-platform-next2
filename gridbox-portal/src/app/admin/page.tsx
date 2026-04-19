"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import AuthPanel from "@/components/AuthPanel";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboardSection from "@/components/admin/sections/AdminDashboardSection";
import AdminProvisioningSection from "@/components/admin/sections/AdminProvisioningSection";
import AdminCustomersSection from "@/components/admin/sections/AdminCustomersSection";
import AdminSitesSection from "@/components/admin/sections/AdminSitesSection";
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
  fetchAdminPath,
  postAdminJson,
  deleteAdminPath,
  deleteAdminProvisioning,
  updateAdminBox,
  fetchAdminBoxCamera,
  fetchAdminNextCameraIp,
  putAdminBoxCamera,
  updateAdminCustomer,
  updateAdminSite,
  createAdminSite
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
  AdminProvisioningStatus,
  AdminCameraData
} from "@/components/admin/types";
import {
  getBoxLabel,
  isValidEmail,
  formatDate
} from "@/components/admin/helpers";
import {
  navigationItems,
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
  const [sites, setSites] = useState<AdminSiteItem[]>([]);
  const [inviteRoles, setInviteRoles] = useState<AdminRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [newCustomerId, setNewCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");

  const [newSiteId, setNewSiteId] = useState("");
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [newSitePostalCode, setNewSitePostalCode] = useState("");
  const [newSiteCountry, setNewSiteCountry] = useState("");
  const [newSiteCustomerId, setNewSiteCustomerId] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState("customerViewer");
  const [invitePermissions, setInvitePermissions] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState("");

  const [accessBoxId, setAccessBoxId] = useState("");

  const [provisioningCustomerId, setProvisioningCustomerId] = useState("");
  const [provisioningSiteId, setProvisioningSiteId] = useState("");
  const [provisioningBoxId, setProvisioningBoxId] = useState("");
  const [rpiConnectAuthKey, setRpiConnectAuthKey] = useState("");
  const [provisioningItem, setProvisioningItem] = useState<AdminProvisioningItem | null>(null);
  const [provisioningItems, setProvisioningItems] = useState<AdminProvisioningItem[]>([]);
  const [provisioningBusy, setProvisioningBusy] = useState(false);
  const [provisioningFinalized, setProvisioningFinalized] = useState(false);
  const [bootstrapDownloadItem, setBootstrapDownloadItem] = useState<Record<string, string> | null>(null);

  const sortedBoxes = [...boxes].sort((a, b) => getBoxLabel(a).localeCompare(getBoxLabel(b)));

  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editBoxCustomerId, setEditBoxCustomerId] = useState("");
  const [editBoxSiteId, setEditBoxSiteId] = useState("");

  const [expandedCameraBoxId, setExpandedCameraBoxId] = useState<string | null>(null);
  const [boxCameras, setBoxCameras] = useState<Record<string, AdminCameraData | null>>({});
  const [camerasBusy, setCamerasBusy] = useState(false);
  const [cameraSaveSuccess, setCameraSaveSuccess] = useState<Record<string, string>>({});
  const [newCameraMac, setNewCameraMac] = useState("");
  const [newCameraIp, setNewCameraIp] = useState("");
  const [newCameraUsername, setNewCameraUsername] = useState("");
  const [newCameraPassword, setNewCameraPassword] = useState("");

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

  async function handleUpdateCustomer(customerId: string, data: { name?: string; logoPath?: string }) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await updateAdminCustomer(customerId, data, { token });
    if (res.ok) {
      setSuccessMessage("Klant bijgewerkt");
      await loadAdminData(false);
    } else {
      const err = await res.json().catch(() => ({}));
      setErrorMessage((err as { message?: string }).message || "Fout bij bijwerken klant");
    }
  }

  async function handleCreateSite(e: React.FormEvent) {
    e.preventDefault();
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await createAdminSite({
      id: newSiteId.trim(),
      name: newSiteName.trim(),
      address: newSiteAddress.trim() || undefined,
      city: newSiteCity.trim() || undefined,
      postalCode: newSitePostalCode.trim() || undefined,
      country: newSiteCountry.trim() || undefined,
      customerId: newSiteCustomerId.trim() || undefined
    }, { token });
    if (res.ok) {
      setSuccessMessage("Site aangemaakt");
      setNewSiteId("");
      setNewSiteName("");
      setNewSiteAddress("");
      setNewSiteCity("");
      setNewSitePostalCode("");
      setNewSiteCountry("");
      setNewSiteCustomerId("");
      await loadAdminData(false);
    } else {
      const err = await res.json().catch(() => ({}));
      setErrorMessage((err as { message?: string }).message || "Fout bij aanmaken site");
    }
  }

  async function handleUpdateSite(siteId: string, data: { name?: string; address?: string; city?: string; postalCode?: string; country?: string }) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await updateAdminSite(siteId, data, { token });
    if (res.ok) {
      setSuccessMessage("Site bijgewerkt");
      await loadAdminData(false);
    } else {
      const err = await res.json().catch(() => ({}));
      setErrorMessage((err as { message?: string }).message || "Fout bij bijwerken site");
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

  async function handleDeleteProvisioning(provisioningId: string, boxId: string | null) {
    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await deleteAdminProvisioning(provisioningId, { token });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Verwijderen mislukt");
        return;
      }

      setSuccessMessage(`Provisioning ${provisioningId}${boxId ? ` en box ${boxId}` : ""} verwijderd`);
      await loadAdminData(false);
    } catch {
      setErrorMessage("Netwerkfout bij verwijderen provisioning");
    }
  }

  async function handleUpdateBox(boxId: string) {
    const user = auth.currentUser;
    if (!user) {
      setErrorMessage("Niet aangemeld");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await user.getIdToken();
      const res = await updateAdminBox(boxId, { customerId: editBoxCustomerId, siteId: editBoxSiteId }, { token });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Bijwerken mislukt");
        return;
      }

      setEditingBoxId(null);
      setSuccessMessage(`Box ${boxId} bijgewerkt`);
      await loadAdminData(false);
    } catch {
      setErrorMessage("Netwerkfout bij bijwerken box");
    }
  }

  async function handleExpandCameras(boxId: string) {
    if (expandedCameraBoxId === boxId) {
      setExpandedCameraBoxId(null);
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setExpandedCameraBoxId(boxId);
    setCamerasBusy(true);
    setErrorMessage("");

    try {
      const token = await user.getIdToken();
      const [cameraRes, nextIpRes] = await Promise.all([
        fetchAdminBoxCamera(boxId, { token }),
        fetchAdminNextCameraIp({ token })
      ]);

      const cameraData = await cameraRes.json();
      const existing: AdminCameraData | null = cameraRes.ok ? (cameraData.item ?? null) : null;
      setBoxCameras((prev) => ({ ...prev, [boxId]: existing }));

      if (existing?.mac) setNewCameraMac(existing.mac);
      if (existing?.ip) {
        setNewCameraIp(existing.ip);
      } else {
        const nextIpData = nextIpRes.ok ? await nextIpRes.json() : null;
        if (nextIpData?.ip) setNewCameraIp(nextIpData.ip);
      }
      if (existing?.username) setNewCameraUsername(existing.username);
    } catch {
      setErrorMessage("Netwerkfout bij ophalen camera");
    } finally {
      setCamerasBusy(false);
    }
  }

  async function openCameraSnapshot(boxId: string) {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(
      (await import("@/lib/api")).apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera/snapshot`),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) { setErrorMessage("Snapshot ophalen mislukt"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  async function handleSaveCamera(boxId: string) {
    const user = auth.currentUser;
    if (!user) return;

    setErrorMessage("");
    setCamerasBusy(true);

    try {
      const token = await user.getIdToken();
      const res = await putAdminBoxCamera(
        boxId,
        {
          mac: newCameraMac.trim(),
          ip: newCameraIp.trim(),
          username: newCameraUsername.trim() || undefined,
          password: newCameraPassword.trim() || undefined
        },
        { token }
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Camera opslaan mislukt");
        return;
      }

      setBoxCameras((prev) => ({ ...prev, [boxId]: data.item ?? null }));
      setNewCameraPassword("");
      setCameraSaveSuccess((prev) => ({
        ...prev,
        [boxId]: `Camera opgeslagen. Maak ook een static DHCP lease aan op de router voor MAC ${newCameraMac.trim()} → IP ${newCameraIp.trim()}`
      }));
    } catch {
      setErrorMessage("Netwerkfout bij opslaan camera");
    } finally {
      setCamerasBusy(false);
    }
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
      finalizedBy: typeof source.finalizedBy === "string" ? source.finalizedBy : null
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
      setProvisioningBoxId(boxId);
      setSuccessMessage("Provisioningrecord aangemaakt");
      await loadAdminData(false);
    } catch (error) {
      setErrorMessage("Netwerkfout bij aanmaken provisioning");
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handleDownloadSdScript() {
    const provisioningId = provisioningItem?.id?.trim() || "";

    if (!provisioningId) {
      setErrorMessage("Geen provisioning geselecteerd voor SD-script");
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

      // Step 1: prepare bootstrap-download
      const prepRes = await postAdminJson(
        `/admin/provisioning/${encodeURIComponent(provisioningId)}/bootstrap-download`,
        { token, body: {} }
      );
      const prepData = await prepRes.json();

      if (!prepRes.ok) {
        setErrorMessage(prepData.message || prepData.error || "Kon bootstrap-download niet voorbereiden");
        return;
      }

      const nextBootstrapItem =
        prepData.item && typeof prepData.item === "object"
          ? (prepData.item as Record<string, string>)
          : null;

      if (!nextBootstrapItem?.provisioningId || !nextBootstrapItem?.bootstrapToken) {
        setErrorMessage("Backend gaf geen geldige bootstrap-download terug");
        return;
      }

      setBootstrapDownloadItem(nextBootstrapItem);

      // Step 2: generate and download script
      const scriptRes = await fetch(
        (await import("@/lib/api")).apiUrl(
          `/admin/provisioning/${encodeURIComponent(provisioningId)}/generate-script`
        ),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            rpiConnectAuthKey: rpiConnectAuthKey.trim() || undefined
          })
        }
      );

      if (!scriptRes.ok) {
        const scriptData = await scriptRes.json().catch(() => ({}));
        setErrorMessage((scriptData as any).message || "Script genereren mislukt");
        return;
      }

      const blob = await scriptRes.blob();
      const boxId = provisioningItem?.boxId || provisioningId;
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
      setErrorMessage("Netwerkfout bij genereren SD-script");
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handleMarkSdPrepared() {
    const provisioningId = provisioningItem?.id?.trim() || "";

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
      setSuccessMessage("SD-kaart als klaar gemarkeerd");
      await loadAdminData(false);
    } catch (error) {
      setErrorMessage("Netwerkfout bij opslaan SD-kaartstatus");
    } finally {
      setProvisioningBusy(false);
    }
  }

  async function handleRefreshProvisioning() {
    const provisioningId = provisioningItem?.id?.trim() || "";

    const refreshedItem = await fetchProvisioningById(provisioningId);
    if (refreshedItem) {
      setSuccessMessage("Provisioning opnieuw opgehaald");
    }
  }

  async function handleFinalizeProvisioning() {
    const provisioningId = provisioningItem?.id?.trim() || "";

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
      setProvisioningFinalized(true);
      setSuccessMessage("Provisioning afgerond");
      await loadAdminData(false);
    } catch (error) {
      setErrorMessage("Netwerkfout bij afronden provisioning");
    } finally {
      setProvisioningBusy(false);
    }
  }

  function handleResetProvisioning() {
    setProvisioningItem(null);
    setProvisioningCustomerId("");
    setProvisioningSiteId("");
    setProvisioningBoxId("");
    setBootstrapDownloadItem(null);
    setProvisioningFinalized(false);
    setErrorMessage("");
    setSuccessMessage("");
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

  const canFinalizeProvisioning = (provisioningStatus === "online" || provisioningStatus === "ready") && !provisioningBusy;
  const canRefreshProvisioning = !provisioningBusy && Boolean(provisioningItem?.id);

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
                  customers={customers}
                  siteSummaries={provisioningSiteSummaries}
                  boxes={boxes}
                  provisioningCustomerId={provisioningCustomerId}
                  provisioningSiteId={provisioningSiteId}
                  provisioningBoxId={provisioningBoxId}
                  provisioningItem={provisioningItem}
                  provisioningBusy={provisioningBusy}
                  canRefreshProvisioning={canRefreshProvisioning}
                  canFinalizeProvisioning={canFinalizeProvisioning}
                  provisioningFinalized={provisioningFinalized}
                  bootstrapDownloadItem={bootstrapDownloadItem}
                  onProvisioningCustomerChange={setProvisioningCustomerId}
                  onProvisioningSiteChange={setProvisioningSiteId}
                  onProvisioningBoxIdChange={setProvisioningBoxId}
                  rpiConnectAuthKey={rpiConnectAuthKey}
                  onRpiConnectAuthKeyChange={setRpiConnectAuthKey}
                  onCreateProvisioning={handleCreateProvisioning}
                  onRefreshProvisioning={handleRefreshProvisioning}
                  onFinalizeProvisioning={handleFinalizeProvisioning}
                  onDownloadSdScript={handleDownloadSdScript}
                  onMarkSdPrepared={handleMarkSdPrepared}
                  onResetProvisioning={handleResetProvisioning}
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
                onUpdateCustomer={handleUpdateCustomer}
              />
            )}
{activeSection === "sites" && (
              <AdminSitesSection
                sites={sites}
                boxes={boxes}
                customers={customers}
                onUpdateSite={handleUpdateSite}
                onCreateSite={handleCreateSite}
                newSiteId={newSiteId}
                newSiteName={newSiteName}
                newSiteAddress={newSiteAddress}
                newSiteCity={newSiteCity}
                newSitePostalCode={newSitePostalCode}
                newSiteCountry={newSiteCountry}
                newSiteCustomerId={newSiteCustomerId}
                onNewSiteIdChange={setNewSiteId}
                onNewSiteNameChange={setNewSiteName}
                onNewSiteAddressChange={setNewSiteAddress}
                onNewSiteCityChange={setNewSiteCity}
                onNewSitePostalCodeChange={setNewSitePostalCode}
                onNewSiteCountryChange={setNewSiteCountry}
                onNewSiteCustomerIdChange={setNewSiteCustomerId}
              />
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
                        <th className="pb-3 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBoxes.map((box) => {
                        const isEditing = editingBoxId === box.id;
                        return (
                          <>
                          <tr key={box.id} className="border-b border-slate-100">
                            <td className="py-4 pr-4 font-semibold text-slate-900">
                              {box.boxId || box.id}
                            </td>
                            {isEditing ? (
                              <>
                                <td className="py-3 pr-4">
                                  <select
                                    value={editBoxSiteId}
                                    onChange={(e) => setEditBoxSiteId(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
                                  >
                                    <option value="">-- kies site --</option>
                                    {sites.map((s) => (
                                      <option key={s.id} value={s.id}>{s.id}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3 pr-4">
                                  <select
                                    value={editBoxCustomerId}
                                    onChange={(e) => setEditBoxCustomerId(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
                                  >
                                    <option value="">-- kies klant --</option>
                                    {customers.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name || c.id}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3 pr-4 text-slate-600">{formatDate(box.updatedAt)}</td>
                                <td className="py-3">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBox(box.boxId || box.id)}
                                      disabled={!editBoxCustomerId || !editBoxSiteId}
                                      className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-40"
                                    >
                                      Opslaan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingBoxId(null)}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                    >
                                      Annuleer
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-4 pr-4 text-slate-600">{box.siteId || "-"}</td>
                                <td className="py-4 pr-4 text-slate-600">
                                  {customers.find((c) => c.id === box.customerId)?.name || box.customerId || "-"}
                                </td>
                                <td className="py-4 pr-4 text-slate-600">{formatDate(box.updatedAt)}</td>
                                <td className="py-4">
                                  <div className="flex gap-2">
                                    <Link
                                      href={`/admin/box/_?id=${encodeURIComponent(box.id)}`}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                      title="Box bewerken"
                                    >
                                      ✏️
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => handleExpandCameras(box.boxId || box.id)}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                      title="Camera's beheren"
                                    >
                                      📷
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                          {expandedCameraBoxId === (box.boxId || box.id) && (
                            <tr key={`${box.id}-camera`}>
                              <td colSpan={5} className="bg-slate-50 px-4 pb-4 pt-2">
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <h4 className="mb-3 text-sm font-semibold text-slate-700">Camera voor {box.boxId || box.id}</h4>

                                  {camerasBusy ? (
                                    <p className="text-xs text-slate-500">Laden...</p>
                                  ) : (
                                    <>
                                      {cameraSaveSuccess[box.boxId || box.id] && (
                                        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                                          ✅ {cameraSaveSuccess[box.boxId || box.id]}
                                        </div>
                                      )}

                                      <div className="flex flex-wrap items-end gap-2">
                                        <div className="flex flex-col gap-1">
                                          <label className="text-xs font-semibold text-slate-500">MAC</label>
                                          <input
                                            type="text"
                                            value={newCameraMac}
                                            onChange={(e) => setNewCameraMac(e.target.value)}
                                            placeholder="aa:bb:cc:dd:ee:ff"
                                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 w-40"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-xs font-semibold text-slate-500">IP</label>
                                          <input
                                            type="text"
                                            value={newCameraIp}
                                            onChange={(e) => setNewCameraIp(e.target.value)}
                                            placeholder="192.168.10.100"
                                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 w-36"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-xs font-semibold text-slate-500">Gebruiker</label>
                                          <input
                                            type="text"
                                            value={newCameraUsername}
                                            onChange={(e) => setNewCameraUsername(e.target.value)}
                                            placeholder="admin"
                                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 w-28"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-xs font-semibold text-slate-500">Wachtwoord</label>
                                          <input
                                            type="password"
                                            value={newCameraPassword}
                                            onChange={(e) => setNewCameraPassword(e.target.value)}
                                            placeholder="••••••"
                                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 w-28"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveCamera(box.boxId || box.id)}
                                          disabled={!newCameraMac || !newCameraIp || camerasBusy}
                                          className="rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-40"
                                        >
                                          Opslaan
                                        </button>
                                        {boxCameras[box.boxId || box.id]?.ip && (
                                          <button
                                            type="button"
                                            onClick={() => openCameraSnapshot(box.boxId || box.id)}
                                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                          >
                                            📷 Bekijk snapshot
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          </>
                        );
                      })}

                      {sortedBoxes.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-slate-500">
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
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}















