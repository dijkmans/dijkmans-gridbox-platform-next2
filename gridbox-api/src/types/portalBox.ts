export type PortalBoxStatus = "online" | "offline" | "warning" | "unknown";

export interface PortalBox {
  id: string;
  displayName: string;
  siteId: string;
  siteName: string;
  status: PortalBoxStatus;
  lastHeartbeat?: string;
  canOpen: boolean;
  links: {
    detail: string;
    history?: string;
  };
}
