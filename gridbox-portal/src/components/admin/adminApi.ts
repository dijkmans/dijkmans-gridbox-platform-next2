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

export async function fetchAdminInvites({ token }: FetchOptions) {
  return fetchAdminPath("/admin/invites", { token });
}

export async function fetchAdminRoles({ token }: FetchOptions) {
  return fetchAdminPath("/admin/roles", { token });
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
