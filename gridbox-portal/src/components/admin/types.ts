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

export type AdminRoleItem = {
  id: string;
  label: string;
  active?: boolean;
  assignableInAdmin?: boolean;
};
