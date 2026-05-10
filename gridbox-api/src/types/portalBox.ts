export type PortalBoxStatus = "online" | "offline" | "warning" | "unknown";

export interface PortalBoxShareSummary {
  totalActive: number;
  phoneNumbers: string[];
}

export interface PortalBox {
  id: string;
  displayName: string;
  siteId: string;
  siteName: string;
  status: PortalBoxStatus;
  lastHeartbeat?: string;
  boxIsOpen: boolean;
  lastActionAt?: string;
  lastActionSource?: string;
  canOpen: boolean;
  shareSummary?: PortalBoxShareSummary;
  links: {
    detail: string;
    history?: string;
  };
  occupancy?: "empty" | "occupied";
}
