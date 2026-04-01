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
