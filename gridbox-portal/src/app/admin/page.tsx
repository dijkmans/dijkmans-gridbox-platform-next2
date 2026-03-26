"use client";

import { FormEvent, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";
import AuthPanel from "@/components/AuthPanel";

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

function getBoxLabel(box: AdminBoxItem) {
  const id = box.boxId || box.id;
  const site = box.siteId || "geen-site";
  return `${id} (${site})`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function AdminPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [customerBoxAccess, setCustomerBoxAccess] = useState<CustomerBoxAccessItem[]>([]);
  const [boxes, setBoxes] = useState<AdminBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [newCustomerId, setNewCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
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

      const [customersRes, membershipsRes, customerBoxAccessRes, boxesRes, invitesRes] = await Promise.all([
        fetch(apiUrl("/admin/customers"), { headers }),
        fetch(apiUrl("/admin/memberships"), { headers }),
        fetch(apiUrl("/admin/customer-box-access"), { headers }),
        fetch(apiUrl("/admin/boxes"), { headers }),
        fetch(apiUrl("/admin/invites"), { headers }).catch(() => ({ ok: false, json: async () => ({ items: [] }) } as any))
      ]);

      const [customersData, membershipsData, accessData, boxesData, invitesData] = await Promise.all([
        customersRes.json(), membershipsRes.json(), customerBoxAccessRes.json(), boxesRes.json(), invitesRes.ok ? invitesRes.json() : { items: [] }
      ]);

      setCustomers(customersData.items || []);
      setMemberships(membershipsData.items || []);
      setCustomerBoxAccess(accessData.items || []);
      setBoxes(boxesData.items || []);
      setInvites(invitesData.items || []);
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
    return () => { active = false; unsubscribe(); };
  }, []);

  async function postJson(url: string, body: object) {
    const user = auth.currentUser;
    setErrorMessage("");
    setSuccessMessage("");
    if (!user) { setErrorMessage("Niet aangemeld"); return null; }
    const token = await user.getIdToken();
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { setErrorMessage(data.message || "Opslaan mislukt"); return null; }
    return data;
  }

  async function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();
    const customerId = newCustomerId.trim();
    const customerName = newCustomerName.trim();
    if (!customerId || !customerName) return setErrorMessage("ID en Naam zijn verplicht");
    
    const result = await postJson(apiUrl("/admin/customers"), { id: customerId, name: customerName });
    if (result) {
      setNewCustomerId(""); setNewCustomerName(""); setSuccessMessage("Bedrijf opgeslagen");
      await loadAdminData(false);
    }
  }

  async function handleCreateInvite(e: FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) return setErrorMessage("Kies eerst een bedrijf links");
    const email = inviteEmail.trim();
    if (!isValidEmail(email)) return setErrorMessage("Vul een geldig e-mailadres in");

    const permissions = invitePermissions.split(",").map(i => i.trim()).filter(Boolean);
    const body = {
      email, displayName: inviteDisplayName || undefined, customerId: selectedCustomerId,
      role: inviteRole, scope: permissions.length > 0 ? { permissions } : {}
    };

    const result = await postJson(apiUrl("/admin/invites"), body);
    if (result) {
      setInviteEmail(""); setInviteDisplayName(""); setInviteRole("viewer"); setInvitePermissions("");
      setLastInviteUrl(result.inviteUrl || ""); setSuccessMessage("Uitnodiging verzonden!");
      await loadAdminData(false);
    }
  }

  async function handleCreateAccess(e: FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) return;
    if (!accessBoxId) return setErrorMessage("Kies een box");

    const result = await postJson(apiUrl("/admin/customer-box-access"), { customerId: selectedCustomerId, boxId: accessBoxId });
    if (result) {
      setAccessBoxId(""); setSuccessMessage("Box toegewezen"); await loadAdminData(false);
    }
  }

  async function handleSetCustomerStatus(customerId: string, active: boolean) {
    if (await postJson(apiUrl(`/admin/customers/${encodeURIComponent(customerId)}/status`), { active })) {
      setSuccessMessage(`Bedrijf ${active ? "geactiveerd" : "gedeactiveerd"}`); await loadAdminData(false);
    }
  }

  async function handleSetAccessStatus(accessId: string, active: boolean) {
    if (await postJson(apiUrl(`/admin/customer-box-access/${encodeURIComponent(accessId)}/status`), { active })) {
      setSuccessMessage(`Box-toegang ${active ? "geactiveerd" : "gedeactiveerd"}`); await loadAdminData(false);
    }
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerMembers = memberships.filter(m => m.customerId === selectedCustomerId);
  const customerInvites = invites.filter(i => i.customerId === selectedCustomerId && i.status === "pending");
  const customerAccess = customerBoxAccess.filter(a => a.customerId === selectedCustomerId);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-500">Beheer van bedrijven, toegang en boxen</p>
          </div>
          <AuthPanel />
        </div>

        {errorMessage && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{errorMessage}</div>}
        {successMessage && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">{successMessage}</div>}

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* LEFT PANE: MASTER LIST */}
          <div className="w-full md:w-1/3">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-wide text-gray-500">1. Selecteer Bedrijf</h2>
            
            <div className="space-y-3 mb-8">
              {customers.map(customer => {
                const isSelected = selectedCustomerId === customer.id;
                const memberCount = memberships.filter(m => m.customerId === customer.id).length;
                const boxCount = customerBoxAccess.filter(a => a.customerId === customer.id).length;

                return (
                  <div 
                    key={customer.id} 
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${isSelected ? 'border-green-500 bg-green-50' : 'border-transparent bg-white shadow-sm hover:shadow-md'}`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-lg">{customer.name || customer.id}</h3>
                      {!customer.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Inactief</span>}
                    </div>
                    <div className="text-sm text-gray-500 flex gap-4 mt-2">
                      <span>👥 {memberCount} Leden</span>
                      <span>📦 {boxCount} Boxen</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CREATE NEW CUSTOMER CARD */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold mb-3">+ Nieuw Bedrijf Toevoegen</h3>
              <form onSubmit={handleCreateCustomer} className="space-y-3">
                <input value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)} placeholder="Bedrijf ID (bv. vabhq)" className="w-full p-2 border rounded" />
                <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Bedrijf Naam" className="w-full p-2 border rounded" />
                <button type="submit" className="w-full bg-gray-800 text-white p-2 rounded hover:bg-black transition">Toevoegen</button>
              </form>
            </div>
          </div>

          {/* RIGHT PANE: DETAILS */}
          <div className="w-full md:w-2/3">
            {selectedCustomer ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">2. Details: <span className="text-green-600">{selectedCustomer.name}</span></h2>
                  <button 
                    onClick={() => handleSetCustomerStatus(selectedCustomer.id, !selectedCustomer.active)}
                    className={`px-4 py-2 text-sm rounded-lg font-bold ${selectedCustomer.active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  >
                    {selectedCustomer.active ? "Bedrijf Deactiveren" : "Bedrijf Activeren"}
                  </button>
                </div>

                {/* MEMBERSHIPS DARK CARD */}
                <div className="bg-[#1e2320] text-gray-200 rounded-2xl p-6 shadow-xl mb-8">
                  <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                    <h3 className="font-bold tracking-wide uppercase">A. Mensen & Toegang</h3>
                  </div>

                  <table className="w-full text-left text-sm mb-6">
                    <thead className="text-gray-400 border-b border-gray-700">
                      <tr>
                        <th className="pb-3 font-medium">E-mail</th>
                        <th className="pb-3 font-medium">Rol</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ACTIEVE LEDEN */}
                      {customerMembers.map(member => (
                        <tr key={member.id} className="border-b border-gray-700/50">
                          <td className="py-4">{member.email}</td>
                          <td className="py-4">
                            <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">{member.role}</span>
                          </td>
                          <td className="py-4 text-green-400">Actief</td>
                        </tr>
                      ))}
                      {/* PENDING INVITES (De openstaande uitnodigingen!) */}
                      {customerInvites.map(invite => (
                        <tr key={invite.id} className="border-b border-gray-700/50 opacity-70">
                          <td className="py-4 flex items-center gap-2">
                            {invite.email} <span className="text-xs bg-yellow-600/30 text-yellow-500 px-2 py-0.5 rounded">Uitgenodigd</span>
                          </td>
                          <td className="py-4">
                            <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">{invite.role}</span>
                          </td>
                          <td className="py-4 text-yellow-500">Wachtend...</td>
                        </tr>
                      ))}
                      {customerMembers.length === 0 && customerInvites.length === 0 && (
                        <tr><td colSpan={3} className="py-4 text-gray-500 text-center">Nog geen leden in dit bedrijf.</td></tr>
                      )}
                    </tbody>
                  </table>

                  {/* UITNODIGEN FORM (Zit in the dark card nu) */}
                  <form onSubmit={handleCreateInvite} className="bg-[#2a302c] p-4 rounded-xl flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs text-gray-400 mb-1 block">Nieuw e-mailadres</label>
                      <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@bedrijf.be" className="w-full bg-[#1e2320] border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-gray-400 mb-1 block">Rol</label>
                      <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full bg-[#1e2320] border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                        <option value="viewer">Viewer</option>
                        <option value="customerAdmin">Admin</option>
                      </select>
                    </div>
                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-500 transition">
                      + Uitnodigen
                    </button>
                  </form>
                  {lastInviteUrl && (
                     <div className="mt-4 p-3 bg-gray-800 rounded text-xs text-gray-300 break-all">
                       <strong>Link:</strong> {lastInviteUrl}
                     </div>
                  )}
                </div>

                {/* BOX ACCESS CARD (Lichte variant voor contrast) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                   <h3 className="font-bold tracking-wide uppercase mb-6 border-b pb-4 text-gray-800">B. Gekoppelde Gridboxen</h3>
                   
                   <div className="space-y-3 mb-6">
                      {customerAccess.map(access => {
                         const box = boxes.find(b => b.id === access.boxId || b.boxId === access.boxId);
                         return (
                           <div key={access.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                             <div>
                               <p className="font-bold">{box ? getBoxLabel(box) : access.boxId}</p>
                               <p className="text-xs text-gray-500">Status: <span className={access.active ? "text-green-600" : "text-red-500"}>{access.active ? "Actief" : "Inactief"}</span></p>
                             </div>
                             <button onClick={() => handleSetAccessStatus(access.id, !access.active)} className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">
                               {access.active ? "Ontkoppel" : "Herkoppel"}
                             </button>
                           </div>
                         )
                      })}
                      {customerAccess.length === 0 && <p className="text-gray-500 text-sm">Dit bedrijf heeft nog geen toegang tot boxen.</p>}
                   </div>

                   <form onSubmit={handleCreateAccess} className="flex gap-3">
                      <select value={accessBoxId} onChange={(e) => setAccessBoxId(e.target.value)} className="flex-1 p-2 border rounded bg-gray-50 focus:border-green-500 focus:outline-none">
                        <option value="">-- Selecteer een Gridbox --</option>
                        {sortedBoxes.map(box => <option key={box.id} value={box.id}>{getBoxLabel(box)}</option>)}
                      </select>
                      <button type="submit" className="bg-gray-800 text-white font-bold py-2 px-4 rounded hover:bg-black transition">
                        Box Toewijzen
                      </button>
                   </form>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 p-12">
                <span className="text-6xl mb-4">👈</span>
                <p className="text-xl">Selecteer links een bedrijf om de details, leden en boxen te beheren.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}