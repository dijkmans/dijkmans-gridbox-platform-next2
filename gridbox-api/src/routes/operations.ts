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

function extractRmsSerial(rms: Record<string, unknown>): string | null {
  const raw = rms["serial"] ?? rms["sn"] ?? rms["serial_number"] ?? null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
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

    // Haal RMS devices op als er gekoppelde boxen zijn OF als er boxen zijn
    // met een gatewaySerial of gatewayMac maar zonder rmsDeviceId (voor auto-linking).
    const boxesNeedingLink = boxes.filter((box) => {
      if (box["rmsDeviceId"]) return false;
      const hw = box["hardware"] as Record<string, unknown> | undefined;
      const hasSerial = typeof hw?.["gatewaySerial"] === "string" && (hw["gatewaySerial"] as string).trim() !== "";
      const hasMac    = typeof hw?.["gatewayMac"]    === "string" && (hw["gatewayMac"]    as string).trim() !== "";
      return hasSerial || hasMac;
    });

    const shouldFetchRms = rmsDeviceIds.length > 0 || boxesNeedingLink.length > 0;
    const rmsMap = shouldFetchRms ? await fetchAllRmsDevices() : {};

    // Auto-link: koppel rmsDeviceId op basis van gatewaySerial of gatewayMac (fire-and-forget)
    if (boxesNeedingLink.length > 0 && Object.keys(rmsMap).length > 0) {
      // Bouw lookup-maps: serial → rmsDeviceId en mac → rmsDeviceId
      const serialToRmsId = new Map<string, number>();
      const macToRmsId    = new Map<string, number>();

      for (const [rmsIdStr, rmsDevice] of Object.entries(rmsMap)) {
        const rmsId = Number(rmsIdStr);

        const rmsSerial = extractRmsSerial(rmsDevice);
        if (rmsSerial) serialToRmsId.set(rmsSerial.toLowerCase(), rmsId);

        // mac_address is een standaard RMS device-veld
        const rmsMac = typeof rmsDevice["mac_address"] === "string"
          ? (rmsDevice["mac_address"] as string).toLowerCase().trim()
          : null;
        if (rmsMac) macToRmsId.set(rmsMac, rmsId);
      }

      for (const box of boxesNeedingLink) {
        const hw = box["hardware"] as Record<string, unknown> | undefined;

        // Probeer eerst serial, dan MAC als fallback
        const gatewaySerial = typeof hw?.["gatewaySerial"] === "string"
          ? (hw["gatewaySerial"] as string).toLowerCase().trim() : "";
        const gatewayMac = typeof hw?.["gatewayMac"] === "string"
          ? (hw["gatewayMac"] as string).toLowerCase().trim() : "";

        const matchedBySerial = gatewaySerial ? serialToRmsId.get(gatewaySerial) : undefined;
        const matchedByMac    = gatewayMac    ? macToRmsId.get(gatewayMac)       : undefined;
        const matchedRmsId    = matchedBySerial ?? matchedByMac;
        const matchedVia      = matchedBySerial !== undefined ? `serial ${gatewaySerial}` : `mac ${gatewayMac}`;

        if (matchedRmsId !== undefined) {
          db.collection("boxes").doc(box.id)
            .update({ rmsDeviceId: matchedRmsId })
            .then(() => console.log(`[rms-link] ${box.id} gekoppeld aan rmsDeviceId ${matchedRmsId} via ${matchedVia}`))
            .catch((err: unknown) => console.error(`[rms-link] Fout bij koppelen ${box.id}:`, err));
          box["rmsDeviceId"] = matchedRmsId;
        }
      }
    }

    const items = boxes.map((box) => {
      const rmsDeviceId = toRmsId(box["rmsDeviceId"]);
      const rmsData = rmsDeviceId !== null ? rmsMap[rmsDeviceId] : null;

      const software = box["software"] as Record<string, unknown> | undefined;
      const lastHeartbeatAt =
        software?.["lastHeartbeatIso"] ??
        box["lastHeartbeatAt"] ??
        (box["status"] === "online" ? (box["updatedAt"] ?? null) : null);

      return {
        ...box,
        lastHeartbeatAt,
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

// ─── Camera DHCP-beheer ───────────────────────────────────────────────

const CAMERA_IP_START = 100;
const CAMERA_IP_END   = 249;
const CAMERA_IP_BASE  = "192.168.10";

function buildSnapshotUrl(ip: string): string {
  return `http://${ip}/snapshot.jpg`;
}

async function suggestCameraIp(db: FirebaseFirestore.Firestore, boxId: string): Promise<string | null> {
  const camerasSnap = await db
    .collection("boxes").doc(boxId)
    .collection("cameras")
    .select("ip")
    .get();

  const usedIps = new Set(
    camerasSnap.docs.map((d) => (d.data() as { ip?: string }).ip).filter(Boolean)
  );

  for (let last = CAMERA_IP_START; last <= CAMERA_IP_END; last++) {
    const candidate = `${CAMERA_IP_BASE}.${last}`;
    if (!usedIps.has(candidate)) return candidate;
  }
  return null; // range exhausted
}

router.get("/operations/boxes/:boxId/cameras", async (req, res) => {
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

    const camerasSnap = await db
      .collection("boxes").doc(boxId)
      .collection("cameras")
      .orderBy("createdAt", "asc")
      .get();

    const cameras = camerasSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>)
    }));

    const suggestedIp = await suggestCameraIp(db, boxId);

    return res.json({ cameras, count: cameras.length, suggestedIp });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in GET /operations/boxes/:boxId/cameras", error);
    return res.status(500).json({ error: "CAMERAS_FETCH_FAILED", message: "Kon camera's niet ophalen" });
  }
});

router.post("/operations/boxes/:boxId/cameras", async (req, res) => {
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

    const body = req.body as {
      ip?: string;
      label?: string;
      macAddress?: string;
      model?: string;
      snapshotPath?: string;
    };

    // Resolve IP: use provided value or suggest first free one in range
    let ip: string;
    if (body.ip && typeof body.ip === "string" && body.ip.trim()) {
      ip = body.ip.trim();
    } else {
      const suggested = await suggestCameraIp(db, boxId);
      if (!suggested) {
        return res.status(409).json({ error: "IP_RANGE_EXHAUSTED", message: "Geen vrij IP-adres meer in bereik 192.168.10.100–249" });
      }
      ip = suggested;
    }

    // Validate IP is within allowed range
    const ipMatch = ip.match(/^192\.168\.10\.(\d+)$/);
    if (!ipMatch) {
      return res.status(400).json({ error: "INVALID_IP", message: "IP moet binnen 192.168.10.x vallen" });
    }
    const lastOctet = parseInt(ipMatch[1], 10);
    if (lastOctet < CAMERA_IP_START || lastOctet > CAMERA_IP_END) {
      return res.status(400).json({
        error: "IP_OUT_OF_RANGE",
        message: `IP moet in bereik 192.168.10.${CAMERA_IP_START}–${CAMERA_IP_END} vallen`
      });
    }

    // Check for duplicate IP
    const existing = await db
      .collection("boxes").doc(boxId)
      .collection("cameras")
      .where("ip", "==", ip)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ error: "IP_ALREADY_IN_USE", message: `IP ${ip} is al in gebruik voor deze box` });
    }

    const snapshotUrl = body.snapshotPath
      ? `http://${ip}${body.snapshotPath.startsWith("/") ? "" : "/"}${body.snapshotPath}`
      : buildSnapshotUrl(ip);

    const now = new Date().toISOString();
    const cameraData: Record<string, unknown> = {
      ip,
      snapshotUrl,
      createdAt: now,
      boxId,
    };
    if (body.label)      cameraData["label"]      = body.label;
    if (body.macAddress) cameraData["macAddress"]  = body.macAddress;
    if (body.model)      cameraData["model"]       = body.model;

    const docRef = await db
      .collection("boxes").doc(boxId)
      .collection("cameras")
      .add(cameraData);

    // Sync hardware.camera.snapshotUrl on the box document to the first camera (by createdAt)
    const firstCameraSnap = await db
      .collection("boxes").doc(boxId)
      .collection("cameras")
      .orderBy("createdAt", "asc")
      .limit(1)
      .get();

    if (!firstCameraSnap.empty) {
      const firstCamera = firstCameraSnap.docs[0].data() as { snapshotUrl?: string };
      if (firstCamera.snapshotUrl) {
        await db.collection("boxes").doc(boxId).update({
          "hardware.camera.snapshotUrl": firstCamera.snapshotUrl,
        });
      }
    }

    return res.status(201).json({ id: docRef.id, ...cameraData });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in POST /operations/boxes/:boxId/cameras", error);
    return res.status(500).json({ error: "CAMERA_CREATE_FAILED", message: "Kon camera niet aanmaken" });
  }
});

router.delete("/operations/boxes/:boxId/cameras/:cameraId", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const boxId    = req.params.boxId?.trim();
    const cameraId = req.params.cameraId?.trim();

    if (!boxId || !cameraId) {
      return res.status(400).json({ error: "INVALID_PARAMS", message: "boxId en cameraId zijn verplicht" });
    }

    const db = getFirestore();

    const boxRef    = db.collection("boxes").doc(boxId);
    const cameraRef = boxRef.collection("cameras").doc(cameraId);

    const cameraDoc = await cameraRef.get();
    if (!cameraDoc.exists) {
      return res.status(404).json({ error: "CAMERA_NOT_FOUND", message: "Camera bestaat niet" });
    }

    await cameraRef.delete();

    // Herbereken hardware.camera.snapshotUrl op het hoofddocument
    const remainingSnap = await boxRef
      .collection("cameras")
      .orderBy("createdAt", "asc")
      .limit(1)
      .get();

    const newSnapshotUrl = remainingSnap.empty
      ? ""
      : ((remainingSnap.docs[0].data() as { snapshotUrl?: string }).snapshotUrl ?? "");

    await boxRef.update({ "hardware.camera.snapshotUrl": newSnapshotUrl });

    return res.json({ deleted: cameraId, hardware: { camera: { snapshotUrl: newSnapshotUrl } } });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in DELETE /operations/boxes/:boxId/cameras/:cameraId", error);
    return res.status(500).json({ error: "CAMERA_DELETE_FAILED", message: "Kon camera niet verwijderen" });
  }
});

export default router;
