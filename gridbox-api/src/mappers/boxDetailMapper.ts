import { FirestoreBoxDocument } from "../repositories/boxRepository";
import { FirestoreSiteDocument } from "../repositories/siteRepository";
import { PortalBoxDetail } from "../types/portalBoxDetail";
import { PortalEvent } from "../types/portalEvent";

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickDisplayName(
  boxId: string,
  data: Record<string, any>,
  siteName?: string
): string {
  return (
    normalizeText(data.displayName) ||
    normalizeText(data.name) ||
    normalizeText(data.info?.name) ||
    normalizeText(data.portal?.displayName) ||
    normalizeText(data.portal?.name) ||
    normalizeText(data.Portal?.DisplayName) ||
    normalizeText(data.Portal?.Name) ||
    (siteName ? `Gridbox ${siteName}` : undefined) ||
    boxId
  );
}

function pickSiteName(data: Record<string, any>, siteDoc?: FirestoreSiteDocument): string {
  return (
    normalizeText(siteDoc?.data?.name) ||
    normalizeText(data.site?.name) ||
    normalizeText(data.info?.site) ||
    normalizeText(data.location?.city) ||
    normalizeText(data.Portal?.Site) ||
    "Onbekende locatie"
  );
}

function pickStatus(data: Record<string, any>): "online" | "warning" | "offline" {
  const heartbeat = normalizeText(data.state?.lastHeartbeatAt) || normalizeText(data.lastHeartbeatAt);

  if (!heartbeat) {
    return "warning";
  }

  const heartbeatDate = new Date(heartbeat);
  if (Number.isNaN(heartbeatDate.getTime())) {
    return "warning";
  }

  const minutesAgo = (Date.now() - heartbeatDate.getTime()) / 60000;

  if (minutesAgo <= 5) {
    return "online";
  }

  if (minutesAgo <= 30) {
    return "warning";
  }

  return "offline";
}

function pickLastHeartbeat(data: Record<string, any>): string | undefined {
  return (
    normalizeText(data.state?.lastHeartbeatAt) ||
    normalizeText(data.lastHeartbeatAt) ||
    normalizeText(data.lifecycle?.updatedAt)
  );
}

function pickConnectivitySummary(data: Record<string, any>): string | undefined {
  if (normalizeText(data.network?.routerName)) {
    return `Online via ${normalizeText(data.network?.routerName)}`;
  }

  const heartbeat = pickLastHeartbeat(data);
  if (!heartbeat) {
    return "Nog geen heartbeat ontvangen";
  }

  return `Laatste heartbeat: ${heartbeat}`;
}

function pickHardwareSummary(data: Record<string, any>): string | undefined {
  const relayState = normalizeText(data.hardware?.relayState);
  const doorState = normalizeText(data.hardware?.doorState);

  if (relayState && doorState) {
    return `Relais ${relayState}, deur ${doorState}`;
  }

  if (relayState) {
    return `Relais ${relayState}`;
  }

  if (doorState) {
    return `Deur ${doorState}`;
  }

  return undefined;
}

function buildRecentEvents(data: Record<string, any>): PortalEvent[] {
  const events: PortalEvent[] = [];

  const openedAt = normalizeText(data.lifecycle?.openedAt);
  if (openedAt) {
    events.push({
      id: "evt-opened",
      type: "opened",
      timestamp: openedAt,
      label: "Laatst geopend",
      severity: "info"
    });
  }

  const closedAt = normalizeText(data.lifecycle?.closedAt);
  if (closedAt) {
    events.push({
      id: "evt-closed",
      type: "closed",
      timestamp: closedAt,
      label: "Laatst gesloten",
      severity: "info"
    });
  }

  return events;
}

export function mapFirestoreBoxToPortalBoxDetail(
  doc: FirestoreBoxDocument,
  siteDoc?: FirestoreSiteDocument
): PortalBoxDetail {
  const siteName = pickSiteName(doc.data, siteDoc);
  const boxIsOpen = doc.data.state?.boxIsOpen === true;
  const isBoxVisibleAndActive = doc.data.active !== false && doc.data.ui?.hidden !== true;

  return {
    id: normalizeText(doc.data.boxId) || doc.id,
    displayName: pickDisplayName(doc.id, doc.data, siteName),
    siteName,
    status: pickStatus(doc.data),
    lastHeartbeat: pickLastHeartbeat(doc.data),
    lastSeen: pickLastHeartbeat(doc.data),
    boxIsOpen,
    availableActions: {
      open: isBoxVisibleAndActive && !boxIsOpen,
      close: isBoxVisibleAndActive && boxIsOpen
    },
    connectivitySummary: pickConnectivitySummary(doc.data),
    hardwareSummary: pickHardwareSummary(doc.data),
    recentEvents: buildRecentEvents(doc.data)
  };
}
