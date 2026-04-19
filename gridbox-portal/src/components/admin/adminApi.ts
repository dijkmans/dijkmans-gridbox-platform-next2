import { apiUrl } from "@/lib/api";

type FetchOptions = {
  token: string;
};

type PostOptions = {
  token: string;
  body: object;
};

type DeleteOptions = {
  token: string;
};

export async function fetchAdminPath(path: string, { token }: FetchOptions) {
  return fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchAdminCustomers({ token }: FetchOptions) {
  return fetchAdminPath("/admin/customers", { token });
}

export async function fetchAdminMemberships({ token }: FetchOptions) {
  return fetchAdminPath("/admin/memberships", { token });
}

export async function fetchAdminCustomerBoxAccess({ token }: FetchOptions) {
  return fetchAdminPath("/admin/customer-box-access", { token });
}

export async function fetchAdminBoxes({ token }: FetchOptions) {
  return fetchAdminPath("/admin/boxes", { token });
}

export async function fetchAdminSites({ token }: FetchOptions) {
  return fetchAdminPath("/admin/sites", { token });
}

export async function fetchAdminInvites({ token }: FetchOptions) {
  return fetchAdminPath("/admin/invites", { token });
}

export async function fetchAdminRoles({ token }: FetchOptions) {
  return fetchAdminPath("/admin/roles", { token });
}

export async function fetchAdminProvisionings({ token }: FetchOptions) {
  return fetchAdminPath("/admin/provisionings", { token });
}

export async function postAdminJson(path: string, { token, body }: PostOptions) {
  return fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export async function deleteAdminPath(path: string, { token }: DeleteOptions) {
  return fetch(apiUrl(path), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function deleteAdminProvisioning(provisioningId: string, { token }: DeleteOptions) {
  return deleteAdminPath(`/admin/provisioning/${encodeURIComponent(provisioningId)}`, { token });
}

export async function updateAdminBox(boxId: string, body: { customerId: string; siteId: string }, { token }: { token: string }) {
  return fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
}

export async function fetchAdminBoxCamera(boxId: string, { token }: FetchOptions) {
  return fetchAdminPath(`/admin/boxes/${encodeURIComponent(boxId)}/camera`, { token });
}

export async function fetchAdminNextCameraIp({ token }: FetchOptions) {
  return fetchAdminPath("/admin/boxes/next-camera-ip", { token });
}

export async function createAdminSite(
  body: { id: string; name: string; address?: string; city?: string; postalCode?: string; country?: string; customerId?: string },
  { token }: { token: string }
) {
  return fetch(apiUrl("/admin/sites"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
}

export async function updateAdminSite(
  siteId: string,
  body: { name?: string; address?: string; city?: string; postalCode?: string; country?: string; active?: boolean },
  { token }: { token: string }
) {
  return fetch(apiUrl(`/admin/sites/${encodeURIComponent(siteId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
}

export async function updateAdminCustomer(
  customerId: string,
  body: { name?: string; logoPath?: string; active?: boolean },
  { token }: { token: string }
) {
  return fetch(apiUrl(`/admin/customers/${encodeURIComponent(customerId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
}

export async function putAdminBoxCamera(
  boxId: string,
  body: { mac: string; ip: string; username?: string; password?: string },
  { token }: { token: string }
) {
  return fetch(apiUrl(`/admin/boxes/${encodeURIComponent(boxId)}/camera`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
}
