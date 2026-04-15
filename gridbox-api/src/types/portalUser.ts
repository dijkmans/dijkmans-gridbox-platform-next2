export type PortalUserRole = "admin" | "customer" | "viewer";

export interface PortalUser {
  id: string;
  email: string;
  displayName: string;
  role: PortalUserRole;
  customerId?: string;
  allowedSiteIds?: string[];
}
