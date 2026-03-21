import { PortalUser } from "../types/portalUser";
import { PortalBox } from "../types/portalBox";
import { PortalBoxDetail } from "../types/portalBoxDetail";
import { PortalEvent } from "../types/portalEvent";

export const mockUser: PortalUser = {
  id: "user-1",
  email: "demo@gridbox.eu",
  displayName: "Demo User",
  role: "admin",
  customerId: "customer-1",
  allowedSiteIds: ["site-geel", "site-mol"]
};

export const mockBoxes: PortalBox[] = [
  {
    id: "box-001",
    displayName: "Gridbox Geel 1",
    siteId: "site-geel",
    siteName: "Geel",
    status: "online",
    lastHeartbeat: new Date().toISOString(),
    canOpen: true,
    links: {
      detail: "/portal/boxes/box-001",
      history: "/portal/boxes/box-001/events"
    }
  },
  {
    id: "box-002",
    displayName: "Gridbox Mol 1",
    siteId: "site-mol",
    siteName: "Mol",
    status: "warning",
    lastHeartbeat: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    canOpen: true,
    links: {
      detail: "/portal/boxes/box-002",
      history: "/portal/boxes/box-002/events"
    }
  }
];

export const mockEventsByBoxId: Record<string, PortalEvent[]> = {
  "box-001": [
    {
      id: "evt-1001",
      type: "heartbeat",
      timestamp: new Date().toISOString(),
      label: "Heartbeat ontvangen",
      severity: "info"
    },
    {
      id: "evt-1002",
      type: "relay_open",
      timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      label: "Relais geopend",
      severity: "info"
    }
  ],
  "box-002": [
    {
      id: "evt-2001",
      type: "heartbeat_delayed",
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      label: "Heartbeat vertraagd",
      severity: "warning"
    }
  ]
};

export const mockBoxDetailsById: Record<string, PortalBoxDetail> = {
  "box-001": {
    id: "box-001",
    displayName: "Gridbox Geel 1",
    siteName: "Geel",
    status: "online",
    lastHeartbeat: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    availableActions: {
      open: true
    },
    connectivitySummary: "Online via router",
    hardwareSummary: "Relais en deurcontact ok",
    recentEvents: mockEventsByBoxId["box-001"]
  },
  "box-002": {
    id: "box-002",
    displayName: "Gridbox Mol 1",
    siteName: "Mol",
    status: "warning",
    lastHeartbeat: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    availableActions: {
      open: true
    },
    connectivitySummary: "Laattijdige heartbeat",
    hardwareSummary: "Laatste status gedeeltelijk oud",
    recentEvents: mockEventsByBoxId["box-002"]
  }
};
