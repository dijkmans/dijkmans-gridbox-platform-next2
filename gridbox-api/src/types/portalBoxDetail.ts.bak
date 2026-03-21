import { PortalEvent } from "./portalEvent";
import { PortalBoxStatus } from "./portalBox";

export interface PortalBoxDetail {
  id: string;
  displayName: string;
  siteName: string;
  status: PortalBoxStatus;
  lastHeartbeat?: string;
  lastSeen?: string;
  availableActions: {
    open: boolean;
  };
  connectivitySummary?: string;
  hardwareSummary?: string;
  recentEvents: PortalEvent[];
}
