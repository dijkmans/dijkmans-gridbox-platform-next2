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

async function fetchRmsDevice(rmsDeviceId: number): Promise<Record<string, unknown> | null> {
  if (!env.rmsApiToken) return null;

  try {
    const res = await fetch(`${env.rmsApiBaseUrl}/devices/${rmsDeviceId}`, {
      headers: { Authorization: `Bearer ${env.rmsApiToken}` }
    });

    if (!res.ok) return null;

    const data = await res.json() as { success: boolean; data?: Record<string, unknown> };
    return data.success && data.data ? data.data : null;
  } catch {
    return null;
  }
}

async function fetchAllRmsDevices(): Promise<Record<number, Record<string, unknown>>> {
  if (!env.rmsApiToken) return {};

  try {
    const res = await fetch(`${env.rmsApiBaseUrl}/devices`, {
      headers: { Authorization: `Bearer ${env.rmsApiToken}` }
    });

    if (!res.ok) return {};

    const data = await res.json() as { success: boolean; data?: Record<string, unknown>[] };
    if (!data.success || !Array.isArray(data.data)) return {};

    const map: Record<number, Record<string, unknown>> = {};
    for (const device of data.data) {
      if (typeof device.id === "number") {
        map[device.id] = device;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function extractRmsSummary(rms: Record<string, unknown>) {
  return {
    rmsStatus: rms.status === 1 ? "online" : "offline",
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

router.get("/operations/boxes", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const db = getFirestore();
    const snapshot = await db.collection("boxes").get();

    const boxes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>)
    })) as Array<{ id: string } & Record<string, unknown>>;

    const toRmsId = (value: unknown): number | null => {
      const parsed = parseInt(String(value), 10);
      return isNaN(parsed) ? null : parsed;
    };

    const rmsDeviceIds = boxes
      .map((box) => toRmsId(box["rmsDeviceId"]))
      .filter((id): id is number => id !== null);

    const rmsMap = rmsDeviceIds.length > 0 ? await fetchAllRmsDevices() : {};

    const items = boxes.map((box) => {
      const rmsDeviceId = toRmsId(box["rmsDeviceId"]);
      const rmsData = rmsDeviceId !== null ? rmsMap[rmsDeviceId] : null;

      return {
        ...box,
        rms: rmsData ? extractRmsSummary(rmsData) : null
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
    const rmsDeviceId = (() => { const p = parseInt(String(box["rmsDeviceId"]), 10); return isNaN(p) ? null : p; })();

    let rmsData: Record<string, unknown> | null = null;
    if (rmsDeviceId !== null) {
      rmsData = await fetchRmsDevice(rmsDeviceId);
    }

    return res.json({
      item: {
        ...box,
        rms: rmsData ?? null
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
