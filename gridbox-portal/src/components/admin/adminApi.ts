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

export async function fetchAdminCustomers({ token }: FetchOptions) {
  return fetch(apiUrl("/admin/customers"), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchAdminMemberships({ token }: FetchOptions) {
  return fetch(apiUrl("/admin/memberships"), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchAdminCustomerBoxAccess({ token }: FetchOptions) {
  return fetch(apiUrl("/admin/customer-box-access"), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchAdminBoxes({ token }: FetchOptions) {
  return fetch(apiUrl("/admin/boxes"), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchAdminInvites({ token }: FetchOptions) {
  return fetch(apiUrl("/admin/invites"), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchAdminRoles({ token }: FetchOptions) {
  return fetch(apiUrl("/admin/roles"), {
    headers: { Authorization: `Bearer ${token}` }
  });
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
