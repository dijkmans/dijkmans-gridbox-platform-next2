import { PortalBox, PortalBoxStatus } from "../types/portalBox";
import { FirestoreBoxDocument } from "../repositories/boxRepository";
import { FirestoreSiteDocument } from "../repositories/siteRepository";

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function pickRawSiteName(data: Record<string, any>): string | undefined {
  return (
    normalizeText(data.site?.name) ||
    normalizeText(data.Portal?.Site) ||
    normalizeText(data.info?.site) ||
    normalizeText(data.location?.city) ||
    undefined
  );
}

function pickSiteId(data: Record<string, any>, fallbackSiteName?: string): string {
  const explicit = normalizeText(data.siteId);
  if (explicit) {
    return explicit;
  }

  if (fallbackSiteName) {
    return slugify(fallbackSiteName) || "unknown-site";
  }

  return "unknown-site";
}

function findSiteDoc(
  siteId: string,
  allSites: FirestoreSiteDocument[]
): FirestoreSiteDocument | undefined {
  return allSites.find((site) => site.id === siteId);
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

function pickDisplayName(
  docId: string,
  data: Record<string, any>,
  resolvedSiteName: string
): string {
  const explicitName =
    normalizeText(data.name) ||
    normalizeText(data.displayName) ||
    normalizeText(data.boxName);

  if (explicitName) {
    return explicitName;
  }

  const boxNumber = data.box?.number ?? data.Portal?.BoxNumber;

  if (resolvedSiteName && boxNumber !== undefined && boxNumber !== null) {
    return `Gridbox ${resolvedSiteName} ${boxNumber}`;
  }

  if (resolvedSiteName && resolvedSiteName !== "Onbekende site") {
    return `Gridbox ${resolvedSiteName}`;
  }

  return docId;
}

function pickLastHeartbeat(data: Record<string, any>): string | undefined {
  return (
    normalizeText(data.software?.lastHeartbeatIso) ||
    normalizeText(data.state?.lastHeartbeatAt) ||
    normalizeText(data.updatedAt) ||
    normalizeText(data.status?.timestamp) ||
    normalizeText(data.lifecycle?.openedAt) ||
    undefined
  );
}

function pickStatus(data: Record<string, any>): PortalBoxStatus {
  const heartbeat = pickLastHeartbeat(data);

  if (!heartbeat) {
    return "unknown";
  }

  const heartbeatDate = new Date(heartbeat);

  if (Number.isNaN(heartbeatDate.getTime())) {
    return "warning";
  }

  const minutesAgo = (Date.now() - heartbeatDate.getTime()) / 60000;

  if (minutesAgo <= 7) {
    return "online";
  }

  if (minutesAgo <= 30) {
    return "warning";
  }

  return "offline";
}

function pickCanOpen(data: Record<string, any>): boolean {
  if (data.active === false) {
    return false;
  }

  if (data.ui?.hidden === true) {
    return false;
  }

  return true;
}

function pickBoxIsOpen(data: Record<string, any>): boolean {
  return data.state?.boxIsOpen === true;
}

function pickLastActionAt(data: Record<string, any>): string | undefined {
  return (
    normalizeText(data.state?.lastActionAt) ||
    normalizeText(data.lifecycle?.openedAt) ||
    normalizeText(data.lifecycle?.closedAt) ||
    undefined
  );
}

function pickLastActionSource(data: Record<string, any>): string | undefined {
  return (
    normalizeText(data.state?.lastActionSource) ||
    normalizeText(data.lifecycle?.source) ||
    undefined
  );
}

export function mapFirestoreBoxToPortalBox(
  doc: FirestoreBoxDocument,
  allSites: FirestoreSiteDocument[]
): PortalBox {
  const rawSiteName = pickRawSiteName(doc.data);
  const siteId = pickSiteId(doc.data, rawSiteName);
  const siteDoc = findSiteDoc(siteId, allSites);
  const siteName = pickSiteName(doc.data, siteDoc);
  const id = normalizeText(doc.data.boxId) || doc.id;

  return {
    id,
    displayName: pickDisplayName(doc.id, doc.data, siteName),
    siteId,
    siteName,
    status: pickStatus(doc.data),
    lastHeartbeat: pickLastHeartbeat(doc.data),
    boxIsOpen: pickBoxIsOpen(doc.data),
    lastActionAt: pickLastActionAt(doc.data),
    lastActionSource: pickLastActionSource(doc.data),
    canOpen: pickCanOpen(doc.data),
    links: {
      detail: `/portal/boxes/${id}`,
      history: `/portal/boxes/${id}/events`
    },
    occupancy: doc.data.occupancy === "empty" || doc.data.occupancy === "occupied"
      ? doc.data.occupancy
      : undefined
  };
}
