export type ActiveSection =
  | "dashboard"
  | "provisioning"
  | "customers"
  | "sites"
  | "boxes"
  | "invites"
  | "memberships"
  | "roles"
  | "logs";

export type NavigationItem = {
  id: ActiveSection;
  label: string;
};

export type ProvisioningStepContent = {
  title: string;
  text: string;
};

export type CustomerItem = {
  id: string;
  name?: string;
  active?: boolean;
  createdAt?: string;
  addedBy?: string;
};

export type MembershipItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
};

export type InviteItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
  status?: string;
  createdAt?: string;
};

export type CustomerBoxAccessItem = {
  id: string;
  customerId?: string;
  boxId?: string;
  active?: boolean;
  createdAt?: string;
  addedBy?: string;
};

export type AdminBoxItem = {
  id: string;
  boxId?: string;
  siteId?: string | null;
  customerId?: string | null;
  updatedAt?: string | null;
};

export type AdminSiteItem = {
  id: string;
  customerId?: string | null;
  name?: string | null;
  active?: boolean;
};

export type AdminRoleItem = {
  id: string;
  label: string;
  active?: boolean;
  assignableInAdmin?: boolean;
};

export type AdminProvisioningStatus =
  | "draft"
  | "awaiting_first_boot"
  | "claimed"
  | "online"
  | "ready"
  | "failed";

export type AdminProvisioningItem = {
  id: string;
  customerId?: string | null;
  siteId?: string | null;
  boxId?: string | null;
  status?: AdminProvisioningStatus | string;
  createdAt?: string | null;
  updatedAt?: string | null;
  claimedAt?: string | null;
  claimedByDevice?: string | null;
  lastHeartbeatAt?: string | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  lastError?: string | null;
  listenerVersion?: string | null;
  i2cStatus?: string | null;
};
