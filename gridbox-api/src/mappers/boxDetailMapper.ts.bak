import { PortalBoxDetail } from "../types/portalBoxDetail";
import { FirestoreBoxDocument } from "../repositories/boxRepository";
import { FirestoreSiteDocument } from "../repositories/siteRepository";
import { PortalEvent } from "../types/portalEvent";

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickSiteName(
  data: Record<string, any>,
  siteDoc?: FirestoreSiteDocument
): string {
  return (
    normalizeText(siteDoc?.data?.name) ||
    normalizeText(data.site?.name) ||
    normalizeText(data.Portal?.Site) ||
    normalizeText(data.info?.site) ||
    normalizeText(siteDoc?.data?.city) ||
    normalizeText(data.location?.city) ||
    "Onbekende site"
  );
}

function pickStatus(data: Record<string, any>): "online" | "offline" | "warning" | "unknown" {
  const simpleStatus = normalizeText(data.status);

  if (simpleStatus) {
    const lowered = simpleStatus.toLowerCase();

    if (["online", "open", "opened"].includes(lowered)) {
      return "online";
    }

    if (["offline"].includes(lowered)) {
      return "offline";
    }

    if (["close", "closed", "closing"].includes(lowered)) {
      return "warning";
    }
  }

  if (typeof data.status === "object" && data.status !== null) {
    if (data.status.online === true) {
      return "online";
    }

    if (data.status.online === false) {
      return "offline";
    }

    const state = normalizeText(data.status.state)?.toLowerCase();
    if (state && ["closing", "opening"].includes(state)) {
      return "warning";
    }

    if (state && ["closed", "open"].includes(state)) {
      return "online";
    }
  }

  const stateState = normalizeText(data.state?.state)?.toLowerCase();
  if (stateState && ["closing", "opening"].includes(stateState)) {
    return "warning";
  }

  if (normalizeText(data.software?.lastHeartbeatIso)) {
    return "online";
  }

  return "unknown";
}

function pickDisplayName(docId: string, data: Record<string, any>, siteName: string): string {
  const explicitName =
    normalizeText(data.name) ||
    normalizeText(data.displayName) ||
    normalizeText(data.boxName);

  if (explicitName) {
    return explicitName;
  }

  const boxNumber = data.box?.number ?? data.Portal?.BoxNumber;

  if (siteName && siteName !== "Onbekende site" && boxNumber !== undefined && boxNumber !== null) {
    return `Gridbox ${siteName} ${boxNumber}`;
  }

  if (siteName && siteName !== "Onbekende site") {
    return `Gridbox ${siteName}`;
  }

  return docId;
}

function pickLastHeartbeat(data: Record<string, any>): string | undefined {
  return (
    normalizeText(data.software?.lastHeartbeatIso) ||
    normalizeText(data.updatedAt) ||
    normalizeText(data.status?.timestamp) ||
    normalizeText(data.lifecycle?.openedAt) ||
    undefined
  );
}

function pickConnectivitySummary(data: Record<string, any>): string | undefined {
  if (typeof data.status === "object" && data.status?.online === true) {
    return "Online";
  }

  if (typeof data.status === "object" && data.status?.online === false) {
    return "Offline";
  }

  if (normalizeText(data.software?.lastHeartbeatIso)) {
    return "Heartbeat ontvangen";
  }

  return undefined;
}

function pickHardwareSummary(data: Record<string, any>): string | undefined {
  const parts: string[] = [];

  if (data.hardware?.camera?.enabled === true) {
    parts.push("camera actief");
  }

  if (data.hardware?.lighting?.enabled === true || data.hardware?.lighting?.onWhenOpen === true) {
    parts.push("verlichting actief");
  }

  if (data.hardware?.autoClose?.enabled === true) {
    parts.push("auto-close actief");
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(", ");
}

function buildRecentEvents(data: Record<string, any>): PortalEvent[] {
  const events: PortalEvent[] = [];

  const heartbeat = normalizeText(data.software?.lastHeartbeatIso);
  if (heartbeat) {
    events.push({
      id: "evt-heartbeat",
      type: "heartbeat",
      timestamp: heartbeat,
      label: "Laatste heartbeat",
      severity: "info"
    });
  }

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

  return {
    id: normalizeText(doc.data.boxId) || doc.id,
    displayName: pickDisplayName(doc.id, doc.data, siteName),
    siteName,
    status: pickStatus(doc.data),
    lastHeartbeat: pickLastHeartbeat(doc.data),
    lastSeen: pickLastHeartbeat(doc.data),
    availableActions: {
      open: doc.data.active !== false && doc.data.ui?.hidden !== true
    },
    connectivitySummary: pickConnectivitySummary(doc.data),
    hardwareSummary: pickHardwareSummary(doc.data),
    recentEvents: buildRecentEvents(doc.data)
  };
}
