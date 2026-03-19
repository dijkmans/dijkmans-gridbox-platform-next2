"use client";

import { FormEvent, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

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

function getActiveColor(active?: boolean) {
  return active ? "green" : "red";
}

function getCustomerName(customerId: string | undefined, customers: CustomerItem[]) {
  if (!customerId) {
    return "-";
  }

  const match = customers.find((item) => item.id === customerId);
  return match?.name || customerId;
}

function getBoxLabel(box: AdminBoxItem) {
  const id = box.boxId || box.id;
  const site = box.siteId || "geen-site";
  return `${id} (${site})`;
}

function getBoxName(boxId: string | undefined, boxes: AdminBoxItem[]) {
  if (!boxId) {
    return "-";
  }

  const match = boxes.find((item) => item.id === boxId || item.boxId === boxId);
  return match ? getBoxLabel(match) : boxId;
}

export default function AdminPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [customerBoxAccess, setCustomerBoxAccess] = useState<CustomerBoxAccessItem[]>([]);
  const [boxes, setBoxes] = useState<AdminBoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newCustomerId, setNewCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");

  const [membershipEmail, setMembershipEmail] = useState("");
  const [membershipCustomerId, setMembershipCustomerId] = useState("");
  const [membershipRole, setMembershipRole] = useState("customerAdmin");

  const [accessCustomerId, setAccessCustomerId] = useState("");
  const [accessBoxId, setAccessBoxId] = useState("");

  const selectableCustomers = customers
    .filter((item) => item.active === true)
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

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
        setCustomers([]);
        setMemberships([]);
        setCustomerBoxAccess([]);
        setBoxes([]);
        setErrorMessage("Meld je aan om admingegevens te bekijken");
        return;
      }

      const token = await user.getIdToken();

      const [customersRes, membershipsRes, customerBoxAccessRes, boxesRes] = await Promise.all([
        fetch("http://localhost:8080/admin/customers", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch("http://localhost:8080/admin/memberships", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch("http://localhost:8080/admin/customer-box-access", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch("http://localhost:8080/admin/boxes", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      const customersData = await customersRes.json();
      const membershipsData = await membershipsRes.json();
      const customerBoxAccessData = await customerBoxAccessRes.json();
      const boxesData = await boxesRes.json();

      if (!customersRes.ok) {
        setErrorMessage(customersData.message || "Kon customers niet ophalen");
        return;
      }

      if (!membershipsRes.ok) {
        setErrorMessage(membershipsData.message || "Kon memberships niet ophalen");
        return;
      }

      if (!customerBoxAccessRes.ok) {
        setErrorMessage(customerBoxAccessData.message || "Kon customerBoxAccess niet ophalen");
        return;
      }

      if (!boxesRes.ok) {
        setErrorMessage(boxesData.message || "Kon boxen niet ophalen");
        return;
      }

      setCustomers(customersData.items || []);
      setMemberships(membershipsData.items || []);
      setCustomerBoxAccess(customerBoxAccessData.items || []);
      setBoxes(boxesData.items || []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Netwerkfout bij admingegevens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    const unsubscribe = auth.onAuthStateChanged(async () => {
      if (!active) {
        return;
      }

      await loadAdminData();
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
      return false;
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
      return false;
    }

    return true;
  }

  async function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();

    const customerId = newCustomerId.trim();
    const customerName = newCustomerName.trim();

    if (!customerId) {
      setErrorMessage("Customer id is verplicht");
      setSuccessMessage("");
      return;
    }

    if (!customerName) {
      setErrorMessage("Customer naam is verplicht");
      setSuccessMessage("");
      return;
    }

    const ok = await postJson("http://localhost:8080/admin/customers", {
      id: customerId,
      name: customerName
    });

    if (!ok) {
      return;
    }

    setNewCustomerId("");
    setNewCustomerName("");
    setSuccessMessage("Customer opgeslagen");
    await loadAdminData(false);
  }

  async function handleCreateMembership(e: FormEvent) {
    e.preventDefault();

    const email = membershipEmail.trim();
    const normalizedEmail = email.toLowerCase();
    const customerId = membershipCustomerId.trim();

    const existingMembership = memberships.find(
      (item) => (item.email || "").toLowerCase() === normalizedEmail
    );

    if (existingMembership?.role === "platformAdmin") {
      setErrorMessage("Bestaande platformAdmin membership kan niet overschreven worden");
      setSuccessMessage("");
      return;
    }

    if (!email) {
      setErrorMessage("Email is verplicht");
      setSuccessMessage("");
      return;
    }

    if (!customerId) {
      setErrorMessage("Kies een customer");
      setSuccessMessage("");
      return;
    }

    const ok = await postJson("http://localhost:8080/admin/memberships", {
      email,
      customerId,
      role: membershipRole
    });

    if (!ok) {
      return;
    }

    setMembershipEmail("");
    setMembershipCustomerId("");
    setMembershipRole("customerAdmin");
    setSuccessMessage("Membership opgeslagen");
    await loadAdminData(false);
  }

  async function handleCreateAccess(e: FormEvent) {
    e.preventDefault();

    const customerId = accessCustomerId.trim();
    const boxId = accessBoxId.trim();

    if (!customerId) {
      setErrorMessage("Kies een customer");
      setSuccessMessage("");
      return;
    }

    if (!boxId) {
      setErrorMessage("Kies een box");
      setSuccessMessage("");
      return;
    }

    const ok = await postJson("http://localhost:8080/admin/customer-box-access", {
      customerId,
      boxId
    });

    if (!ok) {
      return;
    }

    setAccessCustomerId("");
    setAccessBoxId("");
    setSuccessMessage("Box-toegang opgeslagen");
    await loadAdminData(false);
  }

  const activeCustomers = customers.filter((item) => item.active === true).length;
  const inactiveCustomers = customers.filter((item) => item.active !== true).length;

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Admin</h1>
      <p>Beheer van customers, memberships en klant-box toegang</p>

      {loading && <p>Admingegevens laden...</p>}
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      {successMessage && <p style={{ color: "green" }}>{successMessage}</p>}

      <section style={{ marginTop: "20px" }}>
        <h2>Nieuwe customer</h2>
        <form onSubmit={handleCreateCustomer} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
          <p>
            <input
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
              placeholder="customer id, bv umicore"
              style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
            />
          </p>
          <p>
            <input
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="customer naam"
              style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
            />
          </p>
          <button type="submit" style={{ padding: "8px 12px" }}>
            Customer opslaan
          </button>
        </form>
      </section>

      <section style={{ marginTop: "24px" }}>
        <h2>Nieuwe membership</h2>
        <form onSubmit={handleCreateMembership} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
          <p>
            <input
              value={membershipEmail}
              onChange={(e) => setMembershipEmail(e.target.value)}
              placeholder="email"
              style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
            />
          </p>
          <p>
            <select
              value={membershipCustomerId}
              onChange={(e) => setMembershipCustomerId(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
            >
              <option value="">kies actieve customer</option>
              {selectableCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name || customer.id} ({customer.id})
                </option>
              ))}
            </select>
          </p>
          <p>
            <select
              value={membershipRole}
              onChange={(e) => setMembershipRole(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
            >
              <option value="customerAdmin">customerAdmin</option>
              <option value="platformAdmin">platformAdmin</option>
              <option value="viewer">viewer</option>
            </select>
          </p>
          <button type="submit" style={{ padding: "8px 12px" }}>
            Membership opslaan
          </button>
        </form>
      </section>

      <section style={{ marginTop: "24px" }}>
        <h2>Nieuwe box-toegang</h2>
        <form onSubmit={handleCreateAccess} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
          <p>
            <select
              value={accessCustomerId}
              onChange={(e) => setAccessCustomerId(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
            >
              <option value="">kies actieve customer</option>
              {selectableCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name || customer.id} ({customer.id})
                </option>
              ))}
            </select>
          </p>
          <p>
            <select
              value={accessBoxId}
              onChange={(e) => setAccessBoxId(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
            >
              <option value="">kies box</option>
              {sortedBoxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {getBoxLabel(box)}
                </option>
              ))}
            </select>
          </p>
          <button type="submit" style={{ padding: "8px 12px" }}>
            Box-toegang opslaan
          </button>
        </form>
      </section>

      {!loading && (
        <>
          <section style={{ marginTop: "24px" }}>
            <h2>Overzicht</h2>
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
              <p><strong>Aantal customers:</strong> {customers.length}</p>
              <p><strong>Actieve customers:</strong> {activeCustomers}</p>
              <p><strong>Inactieve customers:</strong> {inactiveCustomers}</p>
              <p><strong>Aantal memberships:</strong> {memberships.length}</p>
              <p><strong>Aantal box-toewijzingen:</strong> {customerBoxAccess.length}</p>
              <p><strong>Aantal boxen:</strong> {boxes.length}</p>
            </div>
          </section>

          <section style={{ marginTop: "24px" }}>
            <h2>Customers</h2>
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
              {customers.length === 0 ? (
                <p>Geen customers gevonden</p>
              ) : (
                customers.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "10px 0",
                      opacity: item.active === true ? 1 : 0.7
                    }}
                  >
                    <p><strong>ID:</strong> {item.id}</p>
                    <p><strong>Naam:</strong> {item.name || "-"}</p>
                    <p>
                      <strong>Status:</strong>{" "}
                      <span style={{ color: getActiveColor(item.active) }}>
                        {item.active ? "actief" : "inactief"}
                      </span>
                    </p>
                    <p><strong>Toegevoegd door:</strong> {item.addedBy || "-"}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={{ marginTop: "24px" }}>
            <h2>Memberships</h2>
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
              {memberships.length === 0 ? (
                <p>Geen memberships gevonden</p>
              ) : (
                memberships.map((item) => {
                  const customer = customers.find((c) => c.id === item.customerId);

                  return (
                    <div
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #eee",
                        padding: "10px 0"
                      }}
                    >
                      <p><strong>Email:</strong> {item.email || "-"}</p>
                      <p><strong>Customer:</strong> {getCustomerName(item.customerId, customers)}</p>
                      <p><strong>Rol:</strong> {item.role || "-"}</p>
                      <p>
                        <strong>Customer status:</strong>{" "}
                        <span style={{ color: getActiveColor(customer?.active) }}>
                          {customer?.active ? "actief" : "inactief"}
                        </span>
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section style={{ marginTop: "24px" }}>
            <h2>Customer Box Access</h2>
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
              {customerBoxAccess.length === 0 ? (
                <p>Geen customer-box access records gevonden</p>
              ) : (
                customerBoxAccess.map((item) => {
                  const customer = customers.find((c) => c.id === item.customerId);

                  return (
                    <div
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #eee",
                        padding: "10px 0"
                      }}
                    >
                      <p><strong>Customer:</strong> {getCustomerName(item.customerId, customers)}</p>
                      <p><strong>Box:</strong> {getBoxName(item.boxId, boxes)}</p>
                      <p>
                        <strong>Customer status:</strong>{" "}
                        <span style={{ color: getActiveColor(customer?.active) }}>
                          {customer?.active ? "actief" : "inactief"}
                        </span>
                      </p>
                      <p>
                        <strong>Toewijzing actief:</strong>{" "}
                        <span style={{ color: getActiveColor(item.active) }}>
                          {item.active ? "ja" : "nee"}
                        </span>
                      </p>
                      <p><strong>Toegevoegd door:</strong> {item.addedBy || "-"}</p>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}