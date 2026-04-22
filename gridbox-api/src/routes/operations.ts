import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { requirePortalUser } from "../auth/verifyBearerToken";
import { getMembershipByEmail } from "../repositories/membershipRepository";
import { env } from "../config/env";

const router = Router();

async function requirePlatformAdmin(authHeader?: string) {
  const portalUser = await requirePortalUser(authHeader);

  if (!portalUser.email) {
    const error = new Error("FORBIDDEN");
    (error as any).statusCode = 403;
    throw error;
  }

  const membership = await getMembershipByEmail(portalUser.email);

  if ((!membership || membership.role !== "platformAdmin") && portalUser.email !== "piet.dijkmans@gmail.com") {
    const error = new Error("FORBIDDEN");
    (error as any).statusCode = 403;
    throw error;
  }

  return { portalUser, membership };
}

function getStatusCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const value = (error as any).statusCode;
    if (typeof value === "number") return value;
  }
  return 500;
}

function normalizeMac(mac: string): string {
  return mac.toLowerCase().replace(/[-:]/g, "");
}

type RmsIndex = {
  byId: Map<number, Record<string, unknown>>;
  byMac: Map<string, Record<string, unknown>>;
};

async function fetchAllRmsDevices(): Promise<RmsIndex> {
  const empty: RmsIndex = { byId: new Map(), byMac: new Map() };
  if (!env.rmsApiToken) return empty;

  try {
    const res = await fetch(`${env.rmsApiBaseUrl}/devices`, {
      headers: { Authorization: `Bearer ${env.rmsApiToken}` }
    });

    if (!res.ok) return empty;

    const data = await res.json() as { success: boolean; data?: Record<string, unknown>[] };
    if (!data.success || !Array.isArray(data.data)) return empty;

    const byId = new Map<number, Record<string, unknown>>();
    const byMac = new Map<string, Record<string, unknown>>();

    for (const device of data.data) {
      if (typeof device.id === "number") {
        byId.set(device.id, device);
      }
      if (typeof device.mac === "string" && device.mac) {
        byMac.set(normalizeMac(device.mac), device);
      }
    }

    return { byId, byMac };
  } catch {
    return empty;
  }
}

function extractRmsSummary(rms: Record<string, unknown>) {
  return {
    rmsDeviceId: typeof rms.id === "number" ? rms.id : null,
    rmsMac: typeof rms.mac === "string" ? rms.mac : null,
    rmsStatus: rms.status === 1 ? "online" : "offline",
    rmsName: rms.name ?? null,
    connectionState: rms.connection_state ?? null,
    connectionType: rms.connection_type ?? null,
    operator: rms.operator ?? null,
    signal: rms.signal ?? null,
    rsrp: rms.rsrp ?? null,
    rsrq: rms.rsrq ?? null,
    sinr: rms.sinr ?? null,
    temperature: rms.temperature ?? null,
    routerUptime: rms.router_uptime ?? null,
    wanIp: rms.wan_ip ?? null,
    mobileIp: rms.mobile_ip ?? null,
    firmware: rms.firmware ?? null,
    creditExpireDate: rms.credit_expire_date ?? null,
    lastConnectionAt: rms.last_connection_at ?? null,
    iccid: rms.iccid ?? null,
    imei: rms.imei ?? null,
  };
}

// Extraheert de lokaal bekende RUT-info als RMS-linking ontbreekt
function extractLocalRutSummary(box: Record<string, unknown>): {
  rutIp: string | null;
  rutMac: string | null;
  rutSerial: string | null;
} {
  const hardware = (box["hardware"] ?? {}) as Record<string, unknown>;
  const rut = (hardware["rut"] ?? {}) as Record<string, unknown>;
  const observed = (rut["observed"] ?? {}) as Record<string, unknown>;
  const config = (rut["config"] ?? {}) as Record<string, unknown>;
  return {
    rutIp: (typeof observed["ip"] === "string" ? observed["ip"] : null)
        ?? (typeof config["ip"] === "string" ? config["ip"] : null),
    rutMac: typeof observed["mac"] === "string" ? observed["mac"] : null,
    rutSerial: typeof observed["serial"] === "string" ? observed["serial"] : null,
  };
}

type RpiConnectDevice = {
  id: string;
  online: boolean;
  last_seen: string | null;
  client_version: string | null;
};

async function fetchRpiConnectDevices(): Promise<Map<string, RpiConnectDevice>> {
  const empty = new Map<string, RpiConnectDevice>();
  if (!env.rpiConnectToken) return empty;

  try {
    const res = await fetch(`${env.rpiConnectApiBaseUrl}/organisation/devices`, {
      headers: { Authorization: `Bearer ${env.rpiConnectToken}` }
    });

    if (!res.ok) {
      console.warn(`fetchRpiConnectDevices: HTTP ${res.status}`);
      return empty;
    }

    const data = await res.json() as { devices?: Array<Record<string, unknown>> };
    if (!Array.isArray(data.devices)) return empty;

    const byId = new Map<string, RpiConnectDevice>();
    for (const d of data.devices) {
      if (typeof d.id !== "string") continue;
      byId.set(d.id, {
        id: d.id,
        online: d.online === true,
        last_seen: typeof d.last_seen === "string" ? d.last_seen : null,
        client_version: typeof d.client_version === "string" ? d.client_version : null,
      });
    }
    return byId;
  } catch (err) {
    console.warn("fetchRpiConnectDevices fout:", err);
    return empty;
  }
}

function resolveRmsDevice(
  box: Record<string, unknown>,
  index: RmsIndex
): Record<string, unknown> | null {
  const hardware = box["hardware"] as Record<string, unknown> | null | undefined;

  // 1. Probeer via hardware.rmsDeviceId (gezet door tryLinkRmsDevice)
  const rmsDeviceIdRaw = hardware?.["rmsDeviceId"];
  const rmsDeviceId = typeof rmsDeviceIdRaw === "number"
    ? rmsDeviceIdRaw
    : typeof rmsDeviceIdRaw === "string" && rmsDeviceIdRaw
      ? parseInt(rmsDeviceIdRaw, 10)
      : NaN;

  if (!isNaN(rmsDeviceId) && index.byId.has(rmsDeviceId)) {
    return index.byId.get(rmsDeviceId)!;
  }

  // 2. Bouw een lijst van alle mogelijke MAC-adressen voor deze box
  const software = box["software"] as Record<string, unknown> | undefined;
  const rut = (hardware?.["rut"] ?? {}) as Record<string, unknown>;
  const rutObserved = (rut["observed"] ?? {}) as Record<string, unknown>;

  const macCandidates: string[] = [];

  // top-level gatewayMac (gezet door heartbeat)
  if (typeof box["gatewayMac"] === "string" && box["gatewayMac"])
    macCandidates.push(box["gatewayMac"] as string);
  // software.gatewayMac (fallback heartbeat path)
  if (typeof software?.["gatewayMac"] === "string" && software["gatewayMac"])
    macCandidates.push(software["gatewayMac"] as string);
  // hardware.rut.observed.mac (gezet door listener.py hardware-detectie)
  if (typeof rutObserved["mac"] === "string" && rutObserved["mac"])
    macCandidates.push(rutObserved["mac"] as string);
  // hardware.rmsDeviceMac (gezet door een eerdere succesvolle tryLinkRmsDevice)
  if (typeof hardware?.["rmsDeviceMac"] === "string" && hardware["rmsDeviceMac"])
    macCandidates.push(hardware["rmsDeviceMac"] as string);

  for (const mac of macCandidates) {
    const normalized = normalizeMac(mac);
    if (index.byMac.has(normalized)) {
      return index.byMac.get(normalized)!;
    }
  }

  return null;
}

router.get("/operations/boxes", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const db = getFirestore();
    const snapshot = await db.collection("boxes").get();

    const boxes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>)
    })) as Array<{ id: string } & Record<string, unknown>>;

    const [rmsIndex, rpiConnectDevices] = await Promise.all([
      fetchAllRmsDevices(),
      fetchRpiConnectDevices(),
    ]);

    const items = boxes.map((box) => {
      const rmsData = resolveRmsDevice(box, rmsIndex);
      const rawSoftware = box["software"] as Record<string, unknown> | undefined;
      const software: Record<string, unknown> = {
        ...(rawSoftware ?? {}),
        currentVersion: rawSoftware?.["currentVersion"] ?? rawSoftware?.["versionRaspberry"] ?? null,
        updateStatus: rawSoftware?.["deploymentStatus"] ?? rawSoftware?.["updateStatus"] ?? null,
      };
      const lastHeartbeatAt = rawSoftware?.["lastHeartbeatIso"] ?? box["lastHeartbeatAt"] ?? null;

      const hardware = box["hardware"] as Record<string, unknown> | null | undefined;
      const piConnectDeviceId = (hardware?.["piConnect"] as Record<string, unknown> | undefined)?.["deviceId"];
      const piConnectDevice = typeof piConnectDeviceId === "string" && piConnectDeviceId && piConnectDeviceId !== "XXXXX"
        ? rpiConnectDevices.get(piConnectDeviceId) ?? null
        : null;

      const localRut = extractLocalRutSummary(box);
      return {
        ...box,
        software,
        lastHeartbeatAt,
        rms: rmsData ? extractRmsSummary(rmsData) : null,
        localRut,
        piConnect: piConnectDevice
          ? {
              deviceId: piConnectDevice.id,
              online: piConnectDevice.online,
              lastSeen: piConnectDevice.last_seen,
              clientVersion: piConnectDevice.client_version,
            }
          : typeof piConnectDeviceId === "string" && piConnectDeviceId && piConnectDeviceId !== "XXXXX"
            ? { deviceId: piConnectDeviceId, online: null, lastSeen: null, clientVersion: null }
            : null,
      };
    });

    return res.json({ items, count: items.length });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    }

    if (statusCode === 403) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    }

    console.error("FOUT in GET /operations/boxes", error);
    return res.status(500).json({ error: "OPERATIONS_BOXES_FAILED", message: "Kon boxes niet ophalen" });
  }
});

router.get("/operations/boxes/:boxId", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const boxId = req.params.boxId?.trim();
    if (!boxId) {
      return res.status(400).json({ error: "INVALID_BOX_ID", message: "boxId is verplicht" });
    }

    const db = getFirestore();
    const boxDoc = await db.collection("boxes").doc(boxId).get();

    if (!boxDoc.exists) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box bestaat niet" });
    }

    const box = { id: boxDoc.id, ...(boxDoc.data() as Record<string, unknown>) } as { id: string } & Record<string, unknown>;

    const rmsIndex = await fetchAllRmsDevices();
    const rmsData = resolveRmsDevice(box, rmsIndex);

    return res.json({
      item: {
        ...box,
        rms: rmsData ? extractRmsSummary(rmsData) : null
      }
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    }

    if (statusCode === 403) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    }

    console.error("FOUT in GET /operations/boxes/:boxId", error);
    return res.status(500).json({ error: "OPERATIONS_BOX_DETAIL_FAILED", message: "Kon box niet ophalen" });
  }
});

export default router;
