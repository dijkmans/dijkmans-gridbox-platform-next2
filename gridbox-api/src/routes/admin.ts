import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import { requirePortalUser } from "../auth/verifyBearerToken";
import { env } from "../config/env";
import { getMembershipByEmail } from "../repositories/membershipRepository";
import { listSites } from "../repositories/siteRepository";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

const router = Router();

type SupportedMembershipRole =
  | "platformAdmin"
  | "customerOperator"
  | "customerOperatorNoCamera"
  | "customerViewer";

const SUPPORTED_MEMBERSHIP_ROLES: SupportedMembershipRole[] = [
  "platformAdmin",
  "customerOperator",
  "customerOperatorNoCamera",
  "customerViewer"
];

const ADMIN_ASSIGNABLE_ROLES = new Set<SupportedMembershipRole>([
  "customerOperator",
  "customerOperatorNoCamera",
  "customerViewer"
]);

function isSupportedMembershipRole(value: string): value is SupportedMembershipRole {
  return SUPPORTED_MEMBERSHIP_ROLES.includes(value as SupportedMembershipRole);
}

function getRoleLabel(roleId: SupportedMembershipRole, rawLabel: unknown): string {
  if (typeof rawLabel === "string" && rawLabel.trim()) {
    return rawLabel.trim();
  }

  if (roleId === "customerOperator") {
    return "Operator";
  }

  if (roleId === "customerOperatorNoCamera") {
    return "Operator zonder camera";
  }

  if (roleId === "customerViewer") {
    return "Viewer";
  }

  if (roleId === "platformAdmin") {
    return "Platform Admin";
  }

  return roleId;
}


type ProvisioningStatus =
  | "draft"
  | "awaiting_sd_preparation"
  | "awaiting_first_boot"
  | "claimed"
  | "online"
  | "ready"
  | "failed";

type ProvisioningRecord = {
  id: string;
  boxId: string;
  customerId: string;
  siteId: string;
  status: ProvisioningStatus;
  bootstrapTokenHash: string;
  createdAt: string;
  createdBy: string;
  claimedAt?: string;
  claimedByDevice?: string;
  lastHeartbeatAt?: string;
  lastError?: string;
  profileId?: string;
  notes?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBoxId(value: unknown): string | undefined {
  const normalized = asTrimmedString(value)?.toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function getStatusCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const value = (error as any).statusCode;
    if (typeof value === "number") {
      return value;
    }
  }

  return 500;
}

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

  return {
    portalUser,
    membership
  };
}

router.get("/admin/customers", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    console.log("ADMIN CUSTOMERS REQUEST", {
      user: context.portalUser.email
    });

    const db = getFirestore();
    const snapshot = await db.collection("customers").get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in /admin/customers", error);

    return res.status(500).json({
      error: "ADMIN_CUSTOMERS_FAILED",
      message: "Kon customers niet ophalen"
    });
  }
});

router.get("/admin/sites", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    console.log("ADMIN SITES REQUEST", {
      user: context.portalUser.email
    });

    const siteDocs = await listSites();

    const items = siteDocs
      .map((siteDoc) => {
        const data = siteDoc.data ?? {};

        return {
          id: siteDoc.id,
          customerId: typeof data.customerId === "string" ? data.customerId : null,
          name: typeof data.name === "string" ? data.name : null,
          city: typeof data.city === "string" ? data.city : null,
          address: typeof data.address === "string" ? data.address : null,
          postalCode: typeof data.postalCode === "string" ? data.postalCode : null,
          country: typeof data.country === "string" ? data.country : null,
          active: data.active !== false
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return res.json({
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in GET /admin/sites", error);

    return res.status(500).json({
      error: "ADMIN_SITES_GET_FAILED",
      message: "Kon sites niet ophalen"
    });
  }
});

router.post("/admin/sites", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";

    if (!name) {
      return res.status(400).json({ error: "MISSING_NAME", message: "name is verplicht" });
    }
    if (!city) {
      return res.status(400).json({ error: "MISSING_CITY", message: "city is verplicht" });
    }

    const db = getFirestore();
    const ref = db.collection("sites").doc();
    const now = new Date().toISOString();
    const siteData = {
      name,
      city,
      address: typeof body.address === "string" ? body.address.trim() : null,
      postalCode: typeof body.postalCode === "string" ? body.postalCode.trim() : null,
      country: typeof body.country === "string" ? body.country.trim() : "België",
      customerId: typeof body.customerId === "string" ? body.customerId.trim() : null,
      active: true,
      createdAt: now,
      updatedAt: now
    };

    await ref.set(siteData);

    return res.status(201).json({ item: { id: ref.id, ...siteData } });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in POST /admin/sites", error);
    return res.status(500).json({ error: "ADMIN_SITES_POST_FAILED", message: "Kon site niet aanmaken" });
  }
});

router.patch("/admin/sites/:siteId", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const siteId = req.params.siteId?.trim();
    if (!siteId) {
      return res.status(400).json({ error: "MISSING_SITE_ID", message: "siteId is verplicht" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.city === "string") updates.city = body.city.trim();
    if (typeof body.address === "string") updates.address = body.address.trim();
    if (typeof body.postalCode === "string") updates.postalCode = body.postalCode.trim();
    if (typeof body.country === "string") updates.country = body.country.trim();
    if (typeof body.customerId === "string") updates.customerId = body.customerId.trim();

    const db = getFirestore();
    const ref = db.collection("sites").doc(siteId);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "SITE_NOT_FOUND", message: "Site niet gevonden" });
    }

    await ref.update(updates);

    const updated = { id: siteId, ...(doc.data() as Record<string, unknown>), ...updates };
    return res.json({ item: updated });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in PATCH /admin/sites/:siteId", error);
    return res.status(500).json({ error: "ADMIN_SITES_PATCH_FAILED", message: "Kon site niet aanpassen" });
  }
});

router.get("/admin/boxes", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    console.log("ADMIN BOXES REQUEST", {
      user: context.portalUser.email
    });

    const db = getFirestore();
    const snapshot = await db.collection("boxes").get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;

      return {
        id: doc.id,
        boxId: typeof data.boxId === "string" ? data.boxId : doc.id,
        siteId: data.siteId || null,
        customerId: data.customerId || null,
        updatedAt: data.updatedAt || null
      };
    });

    return res.json({
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in /admin/boxes", error);

    return res.status(500).json({
      error: "ADMIN_BOXES_FAILED",
      message: "Kon boxen niet ophalen"
    });
  }
});

router.put("/admin/boxes/:boxId", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const { customerId, siteId } = req.body as { customerId?: string; siteId?: string };

    if (!customerId || typeof customerId !== "string") {
      return res.status(400).json({ error: "INVALID_INPUT", message: "customerId is verplicht" });
    }
    if (!siteId || typeof siteId !== "string") {
      return res.status(400).json({ error: "INVALID_INPUT", message: "siteId is verplicht" });
    }

    const db = getFirestore();

    const customerDoc = await db.collection("customers").doc(customerId).get();
    if (!customerDoc.exists) {
      return res.status(400).json({ error: "CUSTOMER_NOT_FOUND", message: "Klant niet gevonden" });
    }

    const siteDoc = await db.collection("sites").doc(siteId).get();
    if (!siteDoc.exists) {
      return res.status(400).json({ error: "SITE_NOT_FOUND", message: "Site niet gevonden" });
    }

    // Try by boxId field first, then fall back to doc ID
    let boxDocRef: FirebaseFirestore.DocumentReference | null = null;
    const boxByField = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    if (!boxByField.empty) {
      boxDocRef = boxByField.docs[0].ref;
    } else {
      const boxByDocId = await db.collection("boxes").doc(boxId).get();
      if (boxByDocId.exists) {
        boxDocRef = boxByDocId.ref;
      }
    }

    if (!boxDocRef) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }
    await boxDocRef.set({ customerId, siteId, updatedAt: new Date().toISOString() }, { merge: true });

    console.log("ADMIN BOX UPDATED", { boxId, customerId, siteId, user: context.portalUser.email });

    return res.json({ ok: true });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    }
    if (statusCode === 403) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    }

    console.error("FOUT in PUT /admin/boxes/:boxId", error);
    return res.status(500).json({ error: "BOX_UPDATE_FAILED", message: "Kon box niet bijwerken" });
  }
});

router.get("/admin/boxes/next-camera-ip", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const db = getFirestore();

    const boxesSnapshot = await db.collection("boxes").get();
    const usedIps = new Set<string>();

    boxesSnapshot.docs.forEach((boxDoc) => {
      const data = boxDoc.data() as Record<string, any>;
      const ip = data?.hardware?.camera?.assignment?.ip;
      if (typeof ip === "string") usedIps.add(ip);
    });

    let nextIp: string | null = null;
    for (let i = 100; i <= 249; i++) {
      const candidate = `192.168.10.${i}`;
      if (!usedIps.has(candidate)) {
        nextIp = candidate;
        break;
      }
    }

    if (!nextIp) {
      return res.status(409).json({ error: "NO_IP_AVAILABLE", message: "Geen vrij IP-adres meer beschikbaar in het bereik 192.168.10.100–249" });
    }

    console.log("ADMIN NEXT-CAMERA-IP", { nextIp, user: context.portalUser.email });
    return res.json({ ip: nextIp });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in GET /admin/boxes/next-camera-ip", error);
    return res.status(500).json({ error: "NEXT_IP_FAILED", message: "Kon volgend IP-adres niet bepalen" });
  }
});

router.get("/admin/boxes/:boxId", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const db = getFirestore();

    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDoc = !boxSnap.empty
      ? boxSnap.docs[0]
      : await db.collection("boxes").doc(boxId).get();

    if (!boxDoc.exists) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const data = boxDoc.data() as Record<string, any>;

    const item = {
      id: boxDoc.id,
      boxId: typeof data.boxId === "string" ? data.boxId : boxDoc.id,
      displayName: typeof data.displayName === "string" ? data.displayName : null,
      siteId: data.siteId || null,
      customerId: data.customerId || null,
      updatedAt: data.updatedAt || null,
      autoClose: data.autoClose ?? null,
      hardware: data.hardware ?? null,
      gatewayIp: typeof data.gatewayIp === "string" ? data.gatewayIp : null,
      gatewayMac: typeof data.gatewayMac === "string" ? data.gatewayMac : null,
      rutIp: typeof data.hardware?.rut?.config?.ip === "string" ? data.hardware.rut.config.ip : null,
      rutMac: typeof data.hardware?.rut?.observed?.mac === "string" ? data.hardware.rut.observed.mac : null,
      rutSerial: typeof data.hardware?.rut?.observed?.serial === "string" ? data.hardware.rut.observed.serial : null,
      piMac: typeof data.hardware?.pi?.mac === "string" ? data.hardware.pi.mac : null,
      piIp: typeof data.hardware?.pi?.ip === "string" ? data.hardware.pi.ip : null,

      scriptVersion: typeof data.scriptVersion === "string"
        ? data.scriptVersion
        : typeof data.software?.currentVersion === "string"
          ? data.software.currentVersion
          : null,
      lastProvisionedAt: data.lastProvisionedAt
        || data.state?.lastHeartbeatAt
        || null
    };

    console.log("ADMIN GET BOX", { boxId, user: context.portalUser.email });
    return res.json({ ok: true, item });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in GET /admin/boxes/:boxId", error);
    return res.status(500).json({ error: "BOX_FETCH_FAILED", message: "Kon box niet ophalen" });
  }
});

router.put("/admin/boxes/:boxId/config", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const body = req.body as Record<string, any>;
    const db = getFirestore();

    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDocRef = !boxSnap.empty
      ? boxSnap.docs[0].ref
      : (await db.collection("boxes").doc(boxId).get()).exists
        ? db.collection("boxes").doc(boxId)
        : null;

    if (!boxDocRef) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const update: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (body.autoClose !== undefined && typeof body.autoClose === "object") {
      update["autoClose"] = body.autoClose;
    }

    if (body.hardware?.camera?.config !== undefined && typeof body.hardware.camera.config === "object") {
      const cam = body.hardware.camera.config as Record<string, any>;
      if (typeof cam.enabled === "boolean") update["hardware.camera.config.enabled"] = cam.enabled;
      if (typeof cam.snapshotIntervalSeconds === "number") update["hardware.camera.config.snapshotIntervalSeconds"] = cam.snapshotIntervalSeconds;
      if (typeof cam.changeDetectionThreshold === "number") update["hardware.camera.config.changeDetectionThreshold"] = cam.changeDetectionThreshold;
      if (typeof cam.postCloseSnapshotDurationSeconds === "number") update["hardware.camera.config.postCloseSnapshotDurationSeconds"] = cam.postCloseSnapshotDurationSeconds;
      if (typeof cam.saveCooldownSeconds === "number") update["hardware.camera.config.saveCooldownSeconds"] = cam.saveCooldownSeconds;
      if (typeof cam.forceSaveThresholdMultiplier === "number") update["hardware.camera.config.forceSaveThresholdMultiplier"] = cam.forceSaveThresholdMultiplier;
      if (typeof cam.username === "string") update["hardware.camera.config.username"] = cam.username;
      if (typeof cam.password === "string" && cam.password.length > 0) update["hardware.camera.config.password"] = cam.password;
    }

    if (body.hardware?.lights !== undefined && typeof body.hardware.lights === "object") {
      update["hardware.lighting"] = body.hardware.lights;
    }

    if (body.hardware?.shutter !== undefined && typeof body.hardware.shutter === "object") {
      update["hardware.shutter"] = body.hardware.shutter;
    }

    if (typeof body.displayName === "string") {
      update["displayName"] = body.displayName.trim();
    }

    if (typeof body.siteId === "string") update["siteId"] = body.siteId;
    if (typeof body.customerId === "string") update["customerId"] = body.customerId;

    if (body.hardware?.rut?.config !== undefined && typeof body.hardware.rut.config === "object") {
      const rutConfig = body.hardware.rut.config as Record<string, any>;
      if (typeof rutConfig.ip === "string") update["hardware.rut.config.ip"] = rutConfig.ip;
      if (typeof rutConfig.model === "string" || rutConfig.model === null) update["hardware.rut.config.model"] = rutConfig.model;
      if (typeof rutConfig.username === "string") update["hardware.rut.config.username"] = rutConfig.username;
      if (typeof rutConfig.password === "string" && rutConfig.password.length > 0) update["hardware.rut.config.password"] = rutConfig.password;
    }

    await boxDocRef.update(update);

    console.log("ADMIN BOX CONFIG UPDATED", { boxId, user: context.portalUser.email });
    return res.json({ ok: true });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in PUT /admin/boxes/:boxId/config", error);
    return res.status(500).json({ error: "BOX_CONFIG_UPDATE_FAILED", message: "Kon box config niet opslaan" });
  }
});

async function getRutCredentials(
  siteId: string | null,
  db: Firestore
): Promise<{ ip: string; username: string; password: string } | null> {
  if (!siteId) return null;
  const siteDoc = await db.collection("sites").doc(siteId).get();
  if (!siteDoc.exists) return null;
  const d = siteDoc.data() as Record<string, any>;
  const rut = d?.rut;
  if (!rut?.ip || !rut?.username || !rut?.password) return null;
  return { ip: String(rut.ip), username: String(rut.username), password: String(rut.password) };
}

async function fetchRut241Leases(
  rutIp: string,
  username: string,
  password: string
): Promise<Array<{ ip: string; mac: string; hostname?: string }>> {
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`http://${rutIp}/api/dhcp/leases`, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: controller.signal as any
    });
    if (!res.ok) return [];
    const raw = await res.json() as unknown;
    const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : [];
    return list
      .filter((l): l is Record<string, any> => !!l && typeof l === "object" && typeof (l as any).ip === "string" && typeof (l as any).mac === "string")
      .map((l) => ({ ip: l.ip as string, mac: (l.mac as string).toLowerCase(), hostname: typeof l.hostname === "string" ? l.hostname : undefined }));
  } finally {
    clearTimeout(timeout);
  }
}

router.get("/admin/boxes/:boxId/camera-context", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const db = getFirestore();

    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDoc = !boxSnap.empty
      ? boxSnap.docs[0]
      : await db.collection("boxes").doc(boxId).get();

    if (!boxDoc.exists) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const data = boxDoc.data() as Record<string, any>;
    const camAssignment = data?.hardware?.camera?.assignment ?? null;
    const camConfig = data?.hardware?.camera?.config ?? null;

    const firestoreCamera = camAssignment
      ? {
          ip: camAssignment.ip ?? null,
          mac: camAssignment.mac ?? null,
          snapshotUrl: camAssignment.snapshotUrl ?? null,
          updatedAt: camAssignment.updatedAt ?? null,
          enabled: camConfig?.enabled ?? null
        }
      : null;

    const siteId: string | null = data?.siteId ?? null;
    const rutCreds = await getRutCredentials(siteId, db);

    let detectedMac: string | null = null;
    let detectedIp: string | null = null;
    let routerStatus: "online" | "offline" | "unknown" = "unknown";
    let leaseStatus: "active" | "not_set" | "conflict" | "unknown" = "unknown";
    let lastError: string | null = null;

    if (rutCreds) {
      let leases: Array<{ ip: string; mac: string }> = [];
      try {
        leases = await fetchRut241Leases(rutCreds.ip, rutCreds.username, rutCreds.password);
        routerStatus = "online";
      } catch {
        routerStatus = "offline";
        lastError = `RUT241 op ${rutCreds.ip} niet bereikbaar`;
      }

      if (routerStatus === "online") {
        // Verzamel alle geregistreerde camera-MACs op deze site
        const allBoxesSnap = await db.collection("boxes").get();
        const registeredMacs = new Set<string>();
        allBoxesSnap.docs.forEach((doc) => {
          const d = doc.data() as Record<string, any>;
          if (siteId && d?.siteId !== siteId) return;
          const m = d?.hardware?.camera?.assignment?.mac;
          if (typeof m === "string") registeredMacs.add(m.toLowerCase());
        });

        // Detecteer eerste lease-MAC die nog niet in Firestore staat voor deze site
        const unregistered = leases.find((l) => !registeredMacs.has(l.mac));
        if (unregistered) {
          detectedMac = unregistered.mac;
          detectedIp = unregistered.ip;
        }

        // Bepaal leaseStatus voor de al gekoppelde camera (als die er is)
        if (firestoreCamera?.mac) {
          const hasLease = leases.some((l) => l.mac === firestoreCamera.mac);
          leaseStatus = hasLease ? "active" : "not_set";
        } else {
          leaseStatus = "not_set";
        }
      }
    }

    if (detectedMac && detectedIp) {
      try {
        await boxDoc.ref.update({
          "hardware.camera.observed.detectedMac": detectedMac,
          "hardware.camera.observed.detectedIp": detectedIp,
          "hardware.camera.observed.lastSeenAt": new Date().toISOString()
        });
      } catch {
        // best-effort — niet blokkeren als write faalt
      }
    }

    return res.json({
      firestoreCamera,
      detectedMac,
      detectedIp,
      routerStatus,
      leaseStatus,
      lastError
    });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in GET /admin/boxes/:boxId/camera-context", error);
    return res.status(500).json({ error: "CAMERA_CONTEXT_FAILED", message: "Kon camera-context niet ophalen" });
  }
});

router.post("/admin/boxes/:boxId/camera-suggest-ip", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const db = getFirestore();

    // Haal alle box-camera-IPs op uit Firestore voor dezelfde site
    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDoc = !boxSnap.empty
      ? boxSnap.docs[0]
      : await db.collection("boxes").doc(boxId).get();

    if (!boxDoc.exists) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const boxData = boxDoc.data() as Record<string, any>;
    const siteId: string | null = boxData?.siteId ?? null;

    // Verzamel gebruikte IPs: alle cameras in Firestore op dezelfde site
    const allBoxesSnap = await db.collection("boxes").get();
    const usedIps = new Set<string>();

    allBoxesSnap.docs.forEach((doc) => {
      const d = doc.data() as Record<string, any>;
      if (siteId && d?.siteId !== siteId) return;
      const ip = d?.hardware?.camera?.assignment?.ip;
      if (typeof ip === "string") usedIps.add(ip);
    });

    // Voeg live DHCP lease-IPs toe via RUT241 (best-effort — als router offline is gaan we door met Firestore-data)
    const rutCreds = await getRutCredentials(siteId, db);
    if (rutCreds) {
      try {
        const liveLeases = await fetchRut241Leases(rutCreds.ip, rutCreds.username, rutCreds.password);
        liveLeases.forEach((l) => usedIps.add(l.ip));
      } catch {
        // Router offline — bereken IP alleen op basis van Firestore
      }
    }

    let suggestedIp: string | null = null;
    let conflictsWith: string | null = null;

    for (let i = 100; i <= 249; i++) {
      const candidate = `192.168.10.${i}`;
      if (!usedIps.has(candidate)) {
        suggestedIp = candidate;
        break;
      }
    }

    if (!suggestedIp) {
      return res.status(409).json({
        error: "NO_IP_AVAILABLE",
        message: "Geen vrij IP-adres beschikbaar in het bereik 192.168.10.100–249",
        conflictsWith: null
      });
    }

    return res.json({ suggestedIp, conflictsWith });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in POST /admin/boxes/:boxId/camera-suggest-ip", error);
    return res.status(500).json({ error: "SUGGEST_IP_FAILED", message: "Kon vrij IP niet bepalen" });
  }
});

router.post("/admin/boxes/:boxId/camera-assign", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mac = typeof body.mac === "string" ? body.mac.trim().toLowerCase() : "";
    const chosenIp = typeof body.chosenIp === "string" ? body.chosenIp.trim() : "";

    if (!mac || !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(mac)) {
      return res.status(400).json({ error: "INVALID_MAC", message: "mac moet het formaat xx:xx:xx:xx:xx:xx hebben" });
    }
    const ipMatch = chosenIp.match(/^192\.168\.10\.(\d+)$/);
    if (!ipMatch || parseInt(ipMatch[1], 10) < 100 || parseInt(ipMatch[1], 10) > 249) {
      return res.status(400).json({ error: "INVALID_IP", message: "chosenIp moet 192.168.10.x zijn (100–249)" });
    }

    const db = getFirestore();

    // Stap 1: controleer of MAC al aan een andere box hangt
    const allBoxesSnap = await db.collection("boxes").get();
    for (const doc of allBoxesSnap.docs) {
      const d = doc.data() as Record<string, any>;
      const existingMac = d?.hardware?.camera?.assignment?.mac;
      const existingBoxId = d?.boxId ?? doc.id;
      if (existingMac === mac && existingBoxId !== boxId) {
        return res.status(409).json({
          error: "MAC_CONFLICT",
          message: `MAC ${mac} is al gekoppeld aan box ${existingBoxId}`
        });
      }
    }

    // Stap 2: zet static DHCP lease op de RUT241 via box → site → rut
    const boxForSiteDoc = allBoxesSnap.docs.find((d) => (d.data() as Record<string, any>)?.boxId === boxId || d.id === boxId);
    const siteIdForRut: string | null = boxForSiteDoc ? ((boxForSiteDoc.data() as Record<string, any>)?.siteId ?? null) : null;
    const rutCreds = await getRutCredentials(siteIdForRut, db);

    if (!rutCreds) {
      return res.status(502).json({
        error: "NO_RUT_CREDENTIALS",
        message: "Geen RUT241-gegevens gevonden voor deze site — Firestore niet bijgewerkt"
      });
    }

    const leaseCredentials = Buffer.from(`${rutCreds.username}:${rutCreds.password}`).toString("base64");
    const leaseController = new AbortController();
    const leaseTimeout = setTimeout(() => leaseController.abort(), 8000);
    let leaseRes: Response;
    try {
      leaseRes = await fetch(`http://${rutCreds.ip}/api/dhcp/static`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${leaseCredentials}`
        },
        body: JSON.stringify({ mac, ip: chosenIp }),
        signal: leaseController.signal as any
      });
    } catch {
      clearTimeout(leaseTimeout);
      return res.status(502).json({
        error: "RUT_UNREACHABLE",
        message: `RUT241 op ${rutCreds.ip} niet bereikbaar — Firestore niet bijgewerkt`
      });
    } finally {
      clearTimeout(leaseTimeout);
    }

    if (!leaseRes.ok) {
      const leaseErr = await leaseRes.json().catch(() => ({})) as Record<string, any>;
      return res.status(502).json({
        error: "LEASE_FAILED",
        message: leaseErr?.message || `RUT241 gaf HTTP ${leaseRes.status} terug — Firestore niet bijgewerkt`
      });
    }

    // Stap 3: schrijf naar Firestore pas na bevestigde lease
    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDocRef = !boxSnap.empty
      ? boxSnap.docs[0].ref
      : (await db.collection("boxes").doc(boxId).get()).exists
        ? db.collection("boxes").doc(boxId)
        : null;

    if (!boxDocRef) {
      // Lease is gezet maar box niet gevonden — log expliciet
      console.error(`camera-assign: lease gezet maar box ${boxId} niet gevonden in Firestore`);
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Lease gezet op router maar box niet gevonden in Firestore — controleer handmatig"
      });
    }

    const snapshotUrl = `http://${chosenIp}/cgi-bin/snapshot.cgi`;
    const now = new Date().toISOString();

    try {
      await boxDocRef.update({
        "hardware.camera.assignment.mac": mac,
        "hardware.camera.assignment.ip": chosenIp,
        "hardware.camera.assignment.snapshotUrl": snapshotUrl,
        "hardware.camera.assignment.updatedAt": now
      });
    } catch (firestoreErr) {
      // Lease is gezet maar Firestore schrijven mislukt — log expliciet
      console.error(`camera-assign: lease gezet voor ${boxId} maar Firestore schrijven mislukt:`, firestoreErr);
      return res.status(500).json({
        error: "FIRESTORE_WRITE_FAILED",
        message: "Lease is ingesteld op de router maar Firestore kon niet bijgewerkt worden — controleer handmatig"
      });
    }

    console.log(`camera-assign: ${boxId} → mac=${mac} ip=${chosenIp}`);
    return res.json({
      ok: true,
      mac,
      ip: chosenIp,
      snapshotUrl,
      updatedAt: now
    });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in POST /admin/boxes/:boxId/camera-assign", error);
    return res.status(500).json({ error: "CAMERA_ASSIGN_FAILED", message: "Toewijzen camera mislukt" });
  }
});

router.get("/admin/boxes/:boxId/camera", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const db = getFirestore();

    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDoc = !boxSnap.empty
      ? boxSnap.docs[0]
      : await db.collection("boxes").doc(boxId).get();

    if (!boxDoc.exists) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const data = boxDoc.data() as Record<string, any>;
    const camera = data?.hardware?.camera ?? null;

    console.log("ADMIN GET CAMERA", { boxId, hasCamera: !!camera, user: context.portalUser.email });
    return res.json({
      ok: true,
      item: camera ? {
        config: camera.config ?? null,
        assignment: camera.assignment ?? null,
        observed: camera.observed ?? null
      } : null
    });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in GET /admin/boxes/:boxId/camera", error);
    return res.status(500).json({ error: "CAMERA_FETCH_FAILED", message: "Kon camera niet ophalen" });
  }
});

router.put("/admin/boxes/:boxId/camera", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const { mac, ip, username, password } = req.body as { mac?: string; ip?: string; username?: string; password?: string };

    if (!mac || typeof mac !== "string") {
      return res.status(400).json({ error: "INVALID_INPUT", message: "mac is verplicht" });
    }
    if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac)) {
      return res.status(400).json({ error: "INVALID_MAC", message: "mac moet het formaat xx:xx:xx:xx:xx:xx hebben" });
    }
    if (!ip || typeof ip !== "string") {
      return res.status(400).json({ error: "INVALID_INPUT", message: "ip is verplicht" });
    }
    const ipMatch = ip.match(/^192\.168\.10\.(\d+)$/);
    if (!ipMatch || parseInt(ipMatch[1], 10) < 100 || parseInt(ipMatch[1], 10) > 249) {
      return res.status(400).json({ error: "INVALID_IP", message: "ip moet 192.168.10.x zijn waarbij x tussen 100 en 249 ligt" });
    }

    const db = getFirestore();

    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDocRef = !boxSnap.empty
      ? boxSnap.docs[0].ref
      : (await db.collection("boxes").doc(boxId).get()).exists
        ? db.collection("boxes").doc(boxId)
        : null;

    if (!boxDocRef) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const snapshotUrl = `http://${ip}/cgi-bin/snapshot.cgi`;
    const updateData: Record<string, any> = {
      "hardware.camera.assignment.mac": mac.toLowerCase(),
      "hardware.camera.assignment.ip": ip,
      "hardware.camera.assignment.snapshotUrl": snapshotUrl,
      "hardware.camera.assignment.updatedAt": new Date().toISOString()
    };
    if (username !== undefined) updateData["hardware.camera.config.username"] = username || null;
    if (password !== undefined && password.length > 0) updateData["hardware.camera.config.password"] = password;

    await boxDocRef.update(updateData);

    const updatedDoc = await boxDocRef.get();
    const updatedCamera = (updatedDoc.data() as Record<string, any>)?.hardware?.camera ?? {};

    console.log("ADMIN PUT CAMERA", { boxId, ip, mac, user: context.portalUser.email });
    return res.json({ ok: true, item: updatedCamera });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in PUT /admin/boxes/:boxId/camera", error);
    return res.status(500).json({ error: "CAMERA_UPDATE_FAILED", message: "Kon camera niet opslaan" });
  }
});

router.get("/admin/boxes/:boxId/camera/snapshot", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { boxId } = req.params;
    const db = getFirestore();

    const boxSnap = await db.collection("boxes").where("boxId", "==", boxId).limit(1).get();
    const boxDoc = !boxSnap.empty
      ? boxSnap.docs[0]
      : await db.collection("boxes").doc(boxId).get();

    if (!boxDoc.exists) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const data = boxDoc.data() as Record<string, any>;
    const camera = data?.hardware?.camera;
    const snapshotUrl = camera?.assignment?.snapshotUrl;
    const username = camera?.config?.username;
    const password = camera?.config?.password;

    if (!snapshotUrl) {
      return res.status(404).json({ error: "NO_CAMERA", message: "Geen camera gekoppeld aan deze box — bevestig eerst de camera-toewijzing" });
    }

    const headers: Record<string, string> = {};
    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const cameraRes = await fetch(snapshotUrl, { headers });

    if (!cameraRes.ok) {
      return res.status(502).json({ error: "CAMERA_FETCH_FAILED", message: `Camera gaf HTTP ${cameraRes.status} terug` });
    }

    const contentType = cameraRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");

    const buffer = await cameraRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in GET /admin/boxes/:boxId/camera/snapshot", error);
    return res.status(502).json({ error: "SNAPSHOT_FAILED", message: "Kon snapshot niet ophalen" });
  }
});

router.get("/admin/roles", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    console.log("ADMIN ROLES REQUEST", {
      user: context.portalUser.email
    });

    const db = getFirestore();
    const snapshot = await db.collection("roles").get();

    const items = snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, any>;
        const id = doc.id;

        return {
          id,
          label: isSupportedMembershipRole(id) ? getRoleLabel(id, data.label) : id,
          active: data.active !== false,
          assignableInAdmin: data.assignableInAdmin !== false
        };
      })
      .filter((item) => isSupportedMembershipRole(item.id))
      .filter((item) => item.active)
      .filter((item) => item.assignableInAdmin)
      .filter((item) => ADMIN_ASSIGNABLE_ROLES.has(item.id as SupportedMembershipRole))
      .sort((a, b) => a.label.localeCompare(b.label));

    return res.json({
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in /admin/roles", error);

    return res.status(500).json({
      error: "ADMIN_ROLES_FAILED",
      message: "Kon rollen niet ophalen"
    });
  }
});

router.get("/admin/boxes/:boxId/shares", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const boxId = typeof req.params.boxId === "string" ? req.params.boxId.trim() : "";

    if (!boxId) {
      return res.status(400).json({
        error: "INVALID_BOX_ID",
        message: "Box id is verplicht"
      });
    }

    console.log("ADMIN BOX SHARES REQUEST", {
      user: context.portalUser.email,
      boxId
    });

    const db = getFirestore();
    const snapshot = await db.collection("boxes").doc(boxId).collection("shares").get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      const shareId = doc.id;

      let typeGuess: "phone" | "uid" | "unknown" = "unknown";

      if (/^\+\d{8,20}$/.test(shareId)) {
        typeGuess = "phone";
      } else if (/^[A-Za-z0-9_-]{20,}$/.test(shareId)) {
        typeGuess = "uid";
      }

      const active = data.active === true || data.status === "active";

      return {
        id: shareId,
        typeGuess,
        active,
        rawActive: typeof data.active === "boolean" ? data.active : null,
        rawStatus: typeof data.status === "string" ? data.status : null,
        name: typeof data.name === "string" ? data.name : null,
        email: typeof data.email === "string" ? data.email : null,
        role: typeof data.role === "string" ? data.role : null,
        addedBy: typeof data.addedBy === "string" ? data.addedBy : null,
        createdAt: data.createdAt || null,
        raw: data
      };
    });

    return res.json({
      boxId,
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in /admin/boxes/:boxId/shares", error);

    return res.status(500).json({
      error: "ADMIN_BOX_SHARES_FAILED",
      message: "Kon shares niet ophalen"
    });
  }
});

router.post("/admin/customers", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { id, name } = req.body ?? {};

    if (typeof id !== "string" || id.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_CUSTOMER_ID",
        message: "Customer id is verplicht"
      });
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_CUSTOMER_NAME",
        message: "Customer naam is verplicht"
      });
    }

    const customerId = id.trim();
    const customerName = name.trim();

    const db = getFirestore();

    await db.collection("customers").doc(customerId).set(
      {
        name: customerName,
        active: true,
        createdAt: new Date().toISOString(),
        addedBy: context.portalUser.email
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      id: customerId,
      name: customerName
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/customers", error);

    return res.status(500).json({
      error: "ADMIN_CUSTOMER_CREATE_FAILED",
      message: "Kon customer niet aanmaken"
    });
  }
});

router.get("/admin/memberships", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    console.log("ADMIN MEMBERSHIPS REQUEST", {
      user: context.portalUser.email
    });

    const db = getFirestore();
    const snapshot = await db.collection("memberships").get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in /admin/memberships", error);

    return res.status(500).json({
      error: "ADMIN_MEMBERSHIPS_FAILED",
      message: "Kon memberships niet ophalen"
    });
  }
});

router.post("/admin/memberships", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { email, customerId, role } = req.body ?? {};

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_EMAIL",
        message: "Email is verplicht"
      });
    }

    if (typeof customerId !== "string" || customerId.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_CUSTOMER_ID",
        message: "Customer id is verplicht"
      });
    }

    if (typeof role !== "string" || role.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_ROLE",
        message: "Rol is verplicht"
      });
    }

    const db = getFirestore();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCustomerId = customerId.trim();
    const trimmedRole = role.trim();

    const customerDoc = await db.collection("customers").doc(trimmedCustomerId).get();

    if (!customerDoc.exists) {
      return res.status(400).json({
        error: "CUSTOMER_NOT_FOUND",
        message: "Customer bestaat niet"
      });
    }

    const snapshot = await db
      .collection("memberships")
      .where("email", "==", trimmedEmail)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      const existingData = existingDoc.data() as Record<string, any>;

      return res.status(409).json({
        error: "MEMBERSHIP_EMAIL_ALREADY_EXISTS",
        message: "Er bestaat al een membership voor dit e-mailadres. Overschrijven is niet toegestaan.",
        existing: {
          id: existingDoc.id,
          email: existingData.email ?? trimmedEmail,
          customerId: existingData.customerId ?? null,
          role: existingData.role ?? null
        }
      });
    }

    const docRef = await db.collection("memberships").add({
      email: trimmedEmail,
      customerId: trimmedCustomerId,
      role: trimmedRole,
      createdAt: new Date().toISOString(),
      addedBy: context.portalUser.email
    });

    return res.json({
      ok: true,
      id: docRef.id,
      email: trimmedEmail,
      customerId: trimmedCustomerId,
      role: trimmedRole,
      mode: "created"
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/memberships", error);

    return res.status(500).json({
      error: "ADMIN_MEMBERSHIP_CREATE_FAILED",
      message: "Kon membership niet opslaan"
    });
  }
});

router.delete("/admin/memberships/:membershipId", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const membershipId = String(req.params?.membershipId || "").trim();

    if (!membershipId) {
      return res.status(400).json({
        error: "INVALID_MEMBERSHIP_ID",
        message: "Membership id is verplicht"
      });
    }

    const db = getFirestore();
    const membershipRef = db.collection("memberships").doc(membershipId);
    const membershipSnap = await membershipRef.get();

    if (!membershipSnap.exists) {
      return res.status(404).json({
        error: "MEMBERSHIP_NOT_FOUND",
        message: "Membership niet gevonden"
      });
    }

    await membershipRef.delete();

    return res.status(200).json({
      success: true,
      membershipId
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in DELETE /admin/memberships/:membershipId", error);

    return res.status(500).json({
      error: "ADMIN_MEMBERSHIP_DELETE_FAILED",
      message: "Kon membership niet verwijderen"
    });
  }
});
router.get("/admin/customer-box-access", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    console.log("ADMIN CUSTOMER BOX ACCESS REQUEST", {
      user: context.portalUser.email
    });

    const db = getFirestore();
    const snapshot = await db.collection("customerBoxAccess").get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in /admin/customer-box-access", error);

    return res.status(500).json({
      error: "ADMIN_CUSTOMER_BOX_ACCESS_FAILED",
      message: "Kon customerBoxAccess niet ophalen"
    });
  }
});

router.post("/admin/customer-box-access", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const { customerId, boxId } = req.body ?? {};

    if (typeof customerId !== "string" || customerId.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_CUSTOMER_ID",
        message: "Customer id is verplicht"
      });
    }

    if (typeof boxId !== "string" || boxId.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_BOX_ID",
        message: "Box id is verplicht"
      });
    }

    const db = getFirestore();
    const trimmedCustomerId = customerId.trim();
    const trimmedBoxId = boxId.trim();

    const customerDoc = await db.collection("customers").doc(trimmedCustomerId).get();

    if (!customerDoc.exists) {
      return res.status(400).json({
        error: "CUSTOMER_NOT_FOUND",
        message: "Customer bestaat niet"
      });
    }

    const boxDoc = await db.collection("boxes").doc(trimmedBoxId).get();

    if (!boxDoc.exists) {
      return res.status(400).json({
        error: "BOX_NOT_FOUND",
        message: "Box bestaat niet"
      });
    }

    const docId = `${trimmedCustomerId}__${trimmedBoxId}`;

    await db.collection("customerBoxAccess").doc(docId).set(
      {
        customerId: trimmedCustomerId,
        boxId: trimmedBoxId,
        active: true,
        updatedAt: new Date().toISOString(),
        addedBy: context.portalUser.email
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      id: docId,
      customerId: trimmedCustomerId,
      boxId: trimmedBoxId
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/customer-box-access", error);

    return res.status(500).json({
      error: "ADMIN_CUSTOMER_BOX_ACCESS_CREATE_FAILED",
      message: "Kon customer-box access niet opslaan"
    });
  }
});

router.post("/admin/customers/:id/status", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const customerId = req.params.id?.trim();
    const { active } = req.body ?? {};

    if (!customerId) {
      return res.status(400).json({
        error: "INVALID_CUSTOMER_ID",
        message: "Customer id is verplicht"
      });
    }

    if (typeof active !== "boolean") {
      return res.status(400).json({
        error: "INVALID_ACTIVE",
        message: "active moet true of false zijn"
      });
    }

    const db = getFirestore();
    const docRef = db.collection("customers").doc(customerId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "CUSTOMER_NOT_FOUND",
        message: "Customer bestaat niet"
      });
    }

    await docRef.set(
      {
        active,
        updatedAt: new Date().toISOString(),
        updatedBy: context.portalUser.email
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      id: customerId,
      active
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/customers/:id/status", error);

    return res.status(500).json({
      error: "ADMIN_CUSTOMER_STATUS_FAILED",
      message: "Kon customer status niet opslaan"
    });
  }
});

router.post("/admin/customer-box-access/:id/status", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);
    const accessId = req.params.id?.trim();
    const { active } = req.body ?? {};

    if (!accessId) {
      return res.status(400).json({
        error: "INVALID_ACCESS_ID",
        message: "Access id is verplicht"
      });
    }

    if (typeof active !== "boolean") {
      return res.status(400).json({
        error: "INVALID_ACTIVE",
        message: "active moet true of false zijn"
      });
    }

    const db = getFirestore();
    const docRef = db.collection("customerBoxAccess").doc(accessId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "CUSTOMER_BOX_ACCESS_NOT_FOUND",
        message: "Customer-box access bestaat niet"
      });
    }

    await docRef.set(
      {
        active,
        updatedAt: new Date().toISOString(),
        updatedBy: context.portalUser.email
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      id: accessId,
      active
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/customer-box-access/:id/status", error);

    return res.status(500).json({
      error: "ADMIN_CUSTOMER_BOX_ACCESS_STATUS_FAILED",
      message: "Kon customer-box access status niet opslaan"
    });
  }
});

router.get("/admin/invites", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    console.log("ADMIN INVITES REQUEST", {
      user: context.portalUser.email
    });

    const db = getFirestore();
    const snapshot = await db.collection("invites").get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({
      items,
      count: items.length
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in /admin/invites", error);

    return res.status(500).json({
      error: "ADMIN_INVITES_FAILED",
      message: "Kon invites niet ophalen"
    });
  }
});


router.delete("/admin/invites/:inviteId", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const inviteId = String(req.params?.inviteId || "").trim();

    if (!inviteId) {
      return res.status(400).json({
        error: "INVALID_INVITE_ID",
        message: "Invite id is verplicht"
      });
    }

    const db = getFirestore();
    const inviteRef = db.collection("invites").doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return res.status(404).json({
        error: "INVITE_NOT_FOUND",
        message: "Uitnodiging niet gevonden"
      });
    }

    await inviteRef.delete();

    return res.status(200).json({
      success: true,
      inviteId
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in DELETE /admin/invites/:inviteId", error);

    return res.status(500).json({
      error: "ADMIN_INVITE_DELETE_FAILED",
      message: "Kon uitnodiging niet verwijderen"
    });
  }
});

router.post("/admin/provisioning/boxes", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const boxId = normalizeBoxId(body.boxId);
    const customerId = asTrimmedString(body.customerId);
    const siteId = asTrimmedString(body.siteId);
    const profileId = asTrimmedString(body.profileId);
    const notes = asTrimmedString(body.notes);

    if (!boxId) {
      return res.status(400).json({
        error: "INVALID_BOX_ID",
        message: "Geldige boxId is verplicht"
      });
    }

    if (!customerId) {
      return res.status(400).json({
        error: "INVALID_CUSTOMER_ID",
        message: "customerId is verplicht"
      });
    }

    if (!siteId) {
      return res.status(400).json({
        error: "INVALID_SITE_ID",
        message: "siteId is verplicht"
      });
    }

    const db = getFirestore();

    const customerRef = db.collection("customers").doc(customerId);
    const siteRef = db.collection("sites").doc(siteId);
    const boxRef = db.collection("boxes").doc(boxId);

    const [customerDoc, siteDoc, boxDoc] = await Promise.all([
      customerRef.get(),
      siteRef.get(),
      boxRef.get()
    ]);

    if (!customerDoc.exists) {
      return res.status(404).json({
        error: "CUSTOMER_NOT_FOUND",
        message: "Customer bestaat niet"
      });
    }

    if (!siteDoc.exists) {
      return res.status(404).json({
        error: "SITE_NOT_FOUND",
        message: "Site bestaat niet"
      });
    }

    const siteData = siteDoc.data() ?? {};
    console.log("PROVISIONING CREATE: siteData.customerId=", siteData.customerId, "customerId=", customerId, "match=", siteData.customerId === customerId);
    if (siteData.customerId !== customerId) {
      return res.status(400).json({
        error: "SITE_CUSTOMER_MISMATCH",
        message: "Site hoort niet bij de opgegeven customer"
      });
    }

    if (boxDoc.exists) {
      return res.status(409).json({
        error: "BOX_ALREADY_EXISTS",
        message: "Box bestaat al"
      });
    }

    const existingProvisioningsSnapshot = await db
      .collection("provisionings")
      .where("boxId", "==", boxId)
      .limit(10)
      .get();

    const blockingStatuses = new Set<ProvisioningStatus>([
      "draft",
      "awaiting_first_boot",
      "claimed",
      "online"
    ]);

    const existingBlocking = existingProvisioningsSnapshot.docs.find((doc) => {
      const status = doc.data()?.status;
      return typeof status === "string" && blockingStatuses.has(status as ProvisioningStatus);
    });

    if (existingBlocking) {
      return res.status(409).json({
        error: "PROVISIONING_ALREADY_EXISTS",
        message: "Er bestaat al een actieve provisioning voor deze box",
        provisioningId: existingBlocking.id
      });
    }

    const provisioningRef = db.collection("provisionings").doc();
        const createdAt = nowIso();

    const provisioningRecord: ProvisioningRecord = {
      id: provisioningRef.id,
      boxId,
      customerId,
      siteId,
      status: "draft",
      bootstrapTokenHash: "",
      createdAt,
      createdBy: context.portalUser.email || "unknown",
      ...(profileId ? { profileId } : {}),
      ...(notes ? { notes } : {})
    };

    console.log("PROVISIONING CREATE: siteData.customerId=", siteData.customerId, "customerId=", customerId);
    console.log("PROVISIONING CREATE: schrijven naar Firestore, id=", provisioningRef.id);
    await provisioningRef.set(provisioningRecord);
    console.log("PROVISIONING CREATE: schrijven geslaagd, id=", provisioningRef.id);

        const { bootstrapTokenHash: _bootstrapTokenHash, ...publicProvisioningRecord } = provisioningRecord;

    return res.status(201).json({
      ok: true,
      item: publicProvisioningRecord
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/provisioning/boxes", error);

    return res.status(500).json({
      error: "ADMIN_PROVISIONING_CREATE_FAILED",
      message: "Kon provisioning niet aanmaken"
    });
  }
});

router.get("/admin/provisionings", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const db = getFirestore();
    const snapshot = await db.collection("provisionings").orderBy("createdAt", "desc").get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const { bootstrapTokenHash: _bootstrapTokenHash, ...publicData } = data;
      return { id: doc.id, ...publicData };
    });

    return res.json({ items });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    }

    if (statusCode === 403) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    }

    console.error("FOUT in GET /admin/provisionings", error);

    return res.status(500).json({
      error: "ADMIN_PROVISIONINGS_GET_FAILED",
      message: "Kon provisionings niet ophalen"
    });
  }
});

router.get("/admin/provisioning/:id", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const provisioningId = req.params.id?.trim();

    if (!provisioningId) {
      return res.status(400).json({
        error: "INVALID_PROVISIONING_ID",
        message: "Provisioning id is verplicht"
      });
    }

    const db = getFirestore();
    const provisioningDoc = await db.collection("provisionings").doc(provisioningId).get();

    if (!provisioningDoc.exists) {
      return res.status(404).json({
        error: "PROVISIONING_NOT_FOUND",
        message: "Provisioning bestaat niet"
      });
    }

        const item = {
      id: provisioningDoc.id,
      ...provisioningDoc.data()
    };

    const { bootstrapTokenHash: _bootstrapTokenHash, ...publicItem } = item as Record<string, unknown>;

    return res.json({
      item: publicItem
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in GET /admin/provisioning/:id", error);

    return res.status(500).json({
      error: "ADMIN_PROVISIONING_GET_FAILED",
      message: "Kon provisioning niet ophalen"
    });
  }
});


router.post("/admin/provisioning/:id/bootstrap-download", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const provisioningId = req.params.id?.trim();

    if (!provisioningId) {
      return res.status(400).json({
        error: "INVALID_PROVISIONING_ID",
        message: "Provisioning id is verplicht"
      });
    }

    const db = getFirestore();
    const provisioningRef = db.collection("provisionings").doc(provisioningId);
    const provisioningDoc = await provisioningRef.get();

    if (!provisioningDoc.exists) {
      return res.status(404).json({
        error: "PROVISIONING_NOT_FOUND",
        message: "Provisioning bestaat niet"
      });
    }

    const provisioningData = provisioningDoc.data() ?? {};
    const boxId = typeof provisioningData.boxId === "string" ? provisioningData.boxId.trim() : "";
    const status = typeof provisioningData.status === "string" ? provisioningData.status : "";

    if (!boxId) {
      return res.status(400).json({
        error: "PROVISIONING_BOX_ID_MISSING",
        message: "Provisioning bevat geen geldige boxId"
      });
    }

    if (status === "claimed" || status === "online" || status === "ready") {
      return res.status(409).json({
        error: "BOOTSTRAP_DOWNLOAD_NOT_ALLOWED",
        message: "Bootstrap-download is niet meer toegelaten voor deze provisioning"
      });
    }

    const bootstrapToken = randomBytes(24).toString("hex");
    const bootstrapTokenHash = sha256(bootstrapToken);
    const updatedAt = nowIso();

    await provisioningRef.set(
      {
        bootstrapTokenHash,
        updatedAt
      },
      { merge: true }
    );

        const host = req.get("host");

    if (!host) {
      return res.status(500).json({
        error: "API_BASE_URL_UNAVAILABLE",
        message: "Kon geen geldige apiBaseUrl bepalen"
      });
    }

    const apiBaseUrl = `${req.protocol}://${host}`;

    return res.json({
      item: {
        provisioningId,
        boxId,
        bootstrapToken,
        apiBaseUrl,
        bootstrapVersion: "v1"
      }
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/provisioning/:id/bootstrap-download", error);

    return res.status(500).json({
      error: "ADMIN_PROVISIONING_BOOTSTRAP_DOWNLOAD_FAILED",
      message: "Kon bootstrap-download niet voorbereiden"
    });
  }
});


router.post("/admin/provisioning/:id/mark-sd-prepared", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    const provisioningId = req.params.id?.trim();

    if (!provisioningId) {
      return res.status(400).json({
        error: "INVALID_PROVISIONING_ID",
        message: "Provisioning id is verplicht"
      });
    }

    const db = getFirestore();
    const provisioningRef = db.collection("provisionings").doc(provisioningId);
    const provisioningDoc = await provisioningRef.get();

    if (!provisioningDoc.exists) {
      return res.status(404).json({
        error: "PROVISIONING_NOT_FOUND",
        message: "Provisioning bestaat niet"
      });
    }

    const provisioningData = provisioningDoc.data() ?? {};
    const status = typeof provisioningData.status === "string" ? provisioningData.status : "";
    const bootstrapTokenHash =
      typeof provisioningData.bootstrapTokenHash === "string"
        ? provisioningData.bootstrapTokenHash.trim()
        : "";

    if (!bootstrapTokenHash) {
      return res.status(409).json({
        error: "BOOTSTRAP_NOT_PREPARED",
        message: "Bootstrap-download moet eerst uitgevoerd worden"
      });
    }

    if (status !== "draft" && status !== "awaiting_sd_preparation") {
      return res.status(409).json({
        error: "MARK_SD_PREPARED_NOT_ALLOWED",
        message: "SD-kaart kan in deze provisioningstatus niet als klaar gemarkeerd worden"
      });
    }

    const updatedAt = nowIso();

    await provisioningRef.set(
      {
        status: "awaiting_first_boot",
        updatedAt,
        updatedBy: context.portalUser.email || "unknown"
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      id: provisioningId,
      status: "awaiting_first_boot"
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/provisioning/:id/mark-sd-prepared", error);

    return res.status(500).json({
      error: "ADMIN_PROVISIONING_MARK_SD_PREPARED_FAILED",
      message: "Kon SD-kaartstatus niet opslaan"
    });
  }
});

router.post("/admin/provisioning/:id/finalize", async (req, res) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    const provisioningId = req.params.id?.trim();

    if (!provisioningId) {
      return res.status(400).json({
        error: "INVALID_PROVISIONING_ID",
        message: "Provisioning id is verplicht"
      });
    }

    const db = getFirestore();
    const provisioningRef = db.collection("provisionings").doc(provisioningId);
    const provisioningDoc = await provisioningRef.get();

    if (!provisioningDoc.exists) {
      return res.status(404).json({
        error: "PROVISIONING_NOT_FOUND",
        message: "Provisioning bestaat niet"
      });
    }

    const provisioningData = provisioningDoc.data() ?? {};
    const status = typeof provisioningData.status === "string" ? provisioningData.status : "";

    if (status !== "online") {
      return res.status(409).json({
        error: "FINALIZE_NOT_ALLOWED",
        message: "Provisioning kan alleen afgerond worden vanuit status online"
      });
    }

    const updatedAt = nowIso();

    await provisioningRef.set(
      {
        status: "ready",
        updatedAt,
        updatedBy: context.portalUser.email || "unknown",
        finalizedAt: updatedAt,
        finalizedBy: context.portalUser.email || "unknown"
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      id: provisioningId,
      status: "ready"
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/provisioning/:id/finalize", error);

    return res.status(500).json({
      error: "ADMIN_PROVISIONING_FINALIZE_FAILED",
      message: "Kon provisioning niet afronden"
    });
  }
});

router.post("/admin/provisioning/:id/generate-script", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const provisioningId = String(req.params?.id || "").trim();
    if (!provisioningId) {
      return res.status(400).json({
        error: "INVALID_PROVISIONING_ID",
        message: "Provisioning id is verplicht"
      });
    }

    const db = getFirestore();
    const provisioningRef = db.collection("provisionings").doc(provisioningId);
    const provisioningSnap = await provisioningRef.get();

    if (!provisioningSnap.exists) {
      return res.status(404).json({
        error: "PROVISIONING_NOT_FOUND",
        message: "Provisioning niet gevonden"
      });
    }

    const data = provisioningSnap.data() as Record<string, unknown>;

    const boxId = String(data.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({
        error: "BOX_ID_MISSING",
        message: "boxId ontbreekt op provisioning"
      });
    }

    const siteId = String(data.siteId || "").trim();
    const customerId = String(data.customerId || "").trim();

    let siteName = siteId || "(onbekend)";
    let customerName = customerId || "(onbekend)";

    if (siteId) {
      const siteSnap = await db.collection("sites").doc(siteId).get();
      if (siteSnap.exists) {
        const sd = siteSnap.data() as Record<string, unknown>;
        siteName = String(sd.name || siteId);
      }
    }

    if (customerId) {
      const customerSnap = await db.collection("customers").doc(customerId).get();
      if (customerSnap.exists) {
        const cd = customerSnap.data() as Record<string, unknown>;
        customerName = String(cd.name || customerId);
      }
    }

    const blockedStatuses = ["claimed", "online", "ready"];
    const currentStatus = String(data.status || "");
    if (blockedStatuses.includes(currentStatus)) {
      return res.status(409).json({
        error: "PROVISIONING_ALREADY_ACTIVE",
        message: `Script aanmaken niet mogelijk: status is '${currentStatus}'`
      });
    }

    const bootstrapToken = randomBytes(24).toString("hex");
    const bootstrapTokenHash = sha256(bootstrapToken);
    const updatedAt = nowIso();

    await provisioningRef.set(
      {
        bootstrapTokenHash,
        updatedAt,
        status: "awaiting_sd_preparation"
      },
      { merge: true }
    );

    const host = req.get("host");
    if (!host) {
      return res.status(500).json({
        error: "API_BASE_URL_UNAVAILABLE",
        message: "Kon geen geldige apiBaseUrl bepalen"
      });
    }
    const apiBaseUrl = `${req.protocol}://${host}`;
    const bootstrapVersion = "v1";

    // Haal rpi-connect auth key op (best-effort — script werkt ook zonder)
    let rpiConnectAuthKey: string | null = null;
    if (env.rpiConnectToken) {
      try {
        const akRes = await fetch(`${env.rpiConnectApiBaseUrl}/organisation/auth-keys`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.rpiConnectToken}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: `description=${encodeURIComponent(boxId)}&ttl_days=7`
        });
        if (akRes.ok) {
          const akData = await akRes.json() as { secret?: string };
          if (typeof akData.secret === "string" && akData.secret.startsWith("rpoak_")) {
            rpiConnectAuthKey = akData.secret;
            console.log(`generate-script: rpi-connect auth key aangevraagd voor ${boxId}`);
          }
        } else {
          console.warn(`generate-script: rpi-connect API HTTP ${akRes.status} voor ${boxId}`);
        }
      } catch (err) {
        console.warn(`generate-script: rpi-connect auth key aanvragen mislukt voor ${boxId}:`, err);
      }
    }

    const cloudInitUserData = [
      "#cloud-config",
      "hostname: " + boxId,
      "manage_etc_hosts: true",
      "users:",
      "  - name: pi",
      "    groups: sudo",
      "    shell: /bin/bash",
      "    sudo: ALL=(ALL) NOPASSWD:ALL",
      "    lock_passwd: false",
      "    passwd: \"$6$tg23.88YXBunN.r4$6El6fTCo4xsXSMh97vjq887wBTRLNhoESpYrhh8r0aaL1FLcmAGHK1tz9nwddranvunS2CBoILivN559d/Byr0\"",
      "ssh_pwauth: true",
      "chpasswd:",
      "  expire: false",
      "write_files:",
      "  - path: /usr/local/bin/gridbox-bootstrap.sh",
      "    owner: root:root",
      "    permissions: '0755'",
      "    content: |",
      "      #!/bin/bash",
      "      set -e",
      "      BOOT_PATH=\"/boot/firmware\"",
      "      BOOTSTRAP_JSON=\"$BOOT_PATH/box_bootstrap.json\"",
      "      if [ ! -f \"$BOOTSTRAP_JSON\" ]; then",
      "        echo \"box_bootstrap.json niet gevonden, afbreken\"",
      "        exit 1",
      "      fi",
      "      BOX_ID=$(python3 -c \"import json,sys; d=json.load(open(sys.argv[1])); print(d['boxId'])\" \"$BOOTSTRAP_JSON\")",
      "      PROVISIONING_ID=$(python3 -c \"import json,sys; d=json.load(open(sys.argv[1])); print(d['provisioningId'])\" \"$BOOTSTRAP_JSON\")",
      "      BOOTSTRAP_TOKEN=$(python3 -c \"import json,sys; d=json.load(open(sys.argv[1])); print(d['bootstrapToken'])\" \"$BOOTSTRAP_JSON\")",
      "      API_BASE_URL=$(python3 -c \"import json,sys; d=json.load(open(sys.argv[1])); print(d['apiBaseUrl'])\" \"$BOOTSTRAP_JSON\")",
      "      WORK_DIR=\"/home/pi/dijkmans-gridbox-platform-next2\"",
      "      mkdir -p \"$WORK_DIR\"",
      "      SA_SRC=\"$BOOT_PATH/service-account.json\"",
      "      SA_DEST=\"$WORK_DIR/service-account.json\"",
      "      if [ -f \"$SA_SRC\" ]; then",
      "        cp \"$SA_SRC\" \"$SA_DEST\"",
      "        chown pi:pi \"$SA_DEST\"",
      "      fi",
      "      PAYLOAD=$(printf '{\"provisioningId\":\"%s\",\"boxId\":\"%s\",\"bootstrapToken\":\"%s\"}' \"$PROVISIONING_ID\" \"$BOX_ID\" \"$BOOTSTRAP_TOKEN\")",
      "      curl -s -X POST \"$API_BASE_URL/device/bootstrap/claim\" \\",
      "        -H \"Content-Type: application/json\" \\",
      "        -d \"$PAYLOAD\"",
      "      if [ ! -d \"$WORK_DIR/.git\" ]; then",
      "        git clone https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git /tmp/gridbox-clone-tmp",
      "        cp -r /tmp/gridbox-clone-tmp/. \"$WORK_DIR/\"",
      "        rm -rf /tmp/gridbox-clone-tmp",
      "      fi",
      "      if [ -f \"$SA_SRC\" ]; then",
      "        cp \"$SA_SRC\" \"$WORK_DIR/service-account.json\"",
      "      fi",
      "      printf '{\"deviceId\":\"%s\",\"apiBaseUrl\":\"%s\"}' \"$BOX_ID\" \"$API_BASE_URL\" > \"$WORK_DIR/box_config.json\"",
      "      chown pi:pi \"$WORK_DIR/box_config.json\"",
      "      chown -R pi:pi \"$WORK_DIR\"",
      "      pip3 install -r \"$WORK_DIR/requirements.txt\" --break-system-packages",
      "      cp \"$WORK_DIR/gridbox.service\" /etc/systemd/system/",
      "      sed -i 's|WorkingDirectory=.*|WorkingDirectory=/home/pi/dijkmans-gridbox-platform-next2|' /etc/systemd/system/gridbox.service",
      "      systemctl daemon-reload",
      "      systemctl enable gridbox.service",
      "      systemctl start gridbox.service",
      "      echo \"Bootstrap voltooid voor $BOX_ID\"",
      "  - path: /etc/systemd/system/gridbox-bootstrap-init.service",
      "    owner: root:root",
      "    permissions: '0644'",
      "    content: |",
      "      [Unit]",
      "      Description=Gridbox Bootstrap Init",
      "      After=network-online.target",
      "      Wants=network-online.target",
      "      ConditionPathExists=/boot/firmware/box_bootstrap.json",
      "      ",
      "      [Service]",
      "      Type=oneshot",
      "      ExecStart=/usr/local/bin/gridbox-bootstrap.sh",
      "      RemainAfterExit=yes",
      "      StandardOutput=journal",
      "      StandardError=journal",
      "      ",
      "      [Install]",
      "      WantedBy=multi-user.target",
      "  - path: /usr/local/bin/rpi-connect-setup.sh",
      "    owner: root:root",
      "    permissions: '0755'",
      "    content: |",
      "      #!/bin/bash",
      "      AUTH_KEY_FILE=\"/boot/firmware/rpi-connect-auth-key\"",
      "      if [ ! -f \"$AUTH_KEY_FILE\" ]; then exit 0; fi",
      "      loginctl enable-linger pi",
      "      sleep 10",
      "      for i in $(seq 1 18); do",
      "        if [ -S \"/run/user/1000/bus\" ]; then",
      "          break",
      "        fi",
      "        sleep 5",
      "      done",
      "      export XDG_RUNTIME_DIR=/run/user/1000",
      "      export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus",
      "      rpi-connect on",
      "      sleep 5",
      "      rpi-connect signin --auth-key \"$(cat $AUTH_KEY_FILE)\"",
      "      systemctl --user enable rpi-connect",
      "      systemctl --user start rpi-connect",
      "      sleep 3",
      "      SERIAL=$(cat /proc/cpuinfo | grep Serial | awk '{print $3}')",
      "      BOX_ID=$(python3 -c 'import json; print(json.load(open(\"/boot/firmware/box_bootstrap.json\"))[\"boxId\"])' 2>/dev/null || echo '')",
      "      API_URL=$(python3 -c 'import json; print(json.load(open(\"/boot/firmware/box_bootstrap.json\"))[\"apiBaseUrl\"])' 2>/dev/null || echo '')",
      "      RPI_ID=$(curl -sf \"$API_URL/device/rpi-connect-device-id?serial=$SERIAL\" | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"deviceId\") or \"\")' 2>/dev/null || echo '')",
      "      if [ -n \"$RPI_ID\" ] && [ -n \"$BOX_ID\" ]; then",
      "        curl -s -X PATCH \"$API_URL/device/rpi-connect-register\" \\",
      "          -H \"Content-Type: application/json\" \\",
      "          -d \"{\\\"boxId\\\":\\\"$BOX_ID\\\",\\\"deviceId\\\":\\\"$RPI_ID\\\"}\"",
      "      fi",
      "      rm -f \"$AUTH_KEY_FILE\"",
      "  - path: /var/spool/cron/crontabs/pi",
      "    owner: pi:pi",
      "    permissions: '0600'",
      "    content: |",
      "      @reboot /usr/local/bin/rpi-connect-setup.sh >> /var/log/rpi-connect-setup.log 2>&1",
      "runcmd:",
      "  - systemctl daemon-reload",
      "  - systemctl enable gridbox-bootstrap-init.service",
      "  - systemctl start gridbox-bootstrap-init.service",
      "  - chmod 0600 /var/spool/cron/crontabs/pi",
      "  - chown pi:crontab /var/spool/cron/crontabs/pi",
      "  - touch /var/log/rpi-connect-setup.log",
      "  - chown pi:pi /var/log/rpi-connect-setup.log",
      "  - chmod 644 /boot/firmware/rpi-connect-auth-key",
      "  - loginctl enable-linger pi",
      "  - reboot"
    ].join("\n");

    const bootstrapJson = JSON.stringify(
      {
        provisioningId,
        boxId,
        bootstrapToken,
        apiBaseUrl,
        bootstrapVersion
      },
      null,
      2
    );

    const script = [
      "@echo off",
      "net session >nul 2>&1",
      "if %errorLevel% neq 0 (",
      "    powershell -Command \"Start-Process '%~f0' -Verb RunAs\"",
      "    exit /b",
      ")",
      "echo Script gestart als administrator...",
      "set BAT_DIR=%~dp0",
      "pause",
      "powershell -NoProfile -ExecutionPolicy Bypass -Command \"& { $d = '%~dp0'; $d = $d.TrimEnd('\\'); $tmp = $env:TEMP + '\\gridbox-flash-temp.ps1'; $lines = Get-Content '%~f0'; $start = ($lines | Select-String '^::PS_START$').LineNumber; $end = ($lines | Select-String '^::PS_END$').LineNumber; $content = @('$ScriptDir = ''' + $d + '''') + $lines[$start..($end-2)]; $content | Set-Content $tmp -Encoding UTF8; & $tmp; Remove-Item $tmp -ErrorAction SilentlyContinue }\"",
      "exit /b",
      "::PS_START",
      "# Gridbox SD-kaart flash script",
      `# Gegenereerd voor box: ${boxId}`,
      `# Provisioning ID: ${provisioningId}`,
      "",
      "Write-Host \"\"",
      "Write-Host \"============================================\" -ForegroundColor Cyan",
      "Write-Host \"  GRIDBOX SD-KAART FLASH SCRIPT\" -ForegroundColor Cyan",
      "Write-Host \"============================================\" -ForegroundColor Cyan",
      "Write-Host \"\"",
      `Write-Host \"  Box ID          : ${boxId}\" -ForegroundColor White`,
      `Write-Host \"  Klant            : ${customerName}\" -ForegroundColor White`,
      `Write-Host \"  Locatie          : ${siteName}\" -ForegroundColor White`,
      `Write-Host \"  Provisioning ID  : ${provisioningId}\" -ForegroundColor White`,
      "Write-Host \"\"",
      "Write-Host \"============================================\" -ForegroundColor Cyan",
      "Write-Host \"\"",
      "$confirm = Read-Host \"Controleer de gegevens. Doorgaan? (J om te bevestigen)\"",
      "if ($confirm -ne 'J' -and $confirm -ne 'j') {",
      "    Write-Host \"Afgebroken.\" -ForegroundColor Yellow",
      "    exit 0",
      "}",
      "Write-Host \"\"",
      "",
      "# Controleer service-account.json vóór alles",
      "if (-not (Test-Path (Join-Path $ScriptDir 'service-account.json'))) {",
      "    Write-Host \"\" ",
      "    Write-Host \"============================================\" -ForegroundColor Red",
      "    Write-Host \"  FOUT: service-account.json niet gevonden!\" -ForegroundColor Red",
      "    Write-Host \"============================================\" -ForegroundColor Red",
      "    Write-Host \"\" ",
      "    Write-Host \"Zet het bestand naast dit script:\" -ForegroundColor Yellow",
      "    Write-Host \"  $ScriptDir\\service-account.json\" -ForegroundColor White",
      "    Write-Host \"\" ",
      "    Read-Host \"Druk Enter om te sluiten\"",
      "    exit 1",
      "}",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "Write-Host \"=== Gridbox SD-kaart installatie ===\" -ForegroundColor Cyan",
      `Write-Host \"Box: ${boxId}\" -ForegroundColor White`,
      "Write-Host \"\"",
      "",
      "$ImagerPath = \"C:\\Program Files\\Raspberry Pi Ltd\\Imager\\rpi-imager.exe\"",
      "",
      "if (-not (Test-Path $ImagerPath)) {",
      "    Write-Error \"rpi-imager niet gevonden op $ImagerPath\"",
      "    exit 1",
      "}",
      "",
      "# Haal de verwachte imageversie op via latest.json",
      "$LatestJsonUrl    = \"https://storage.googleapis.com/gridbox-platform.firebasestorage.app/master-images/latest.json\"",
      "$ExpectedFilename = \"Gridbox_master_v1.0.60.img.gz\"",
      "$ExpectedVersion  = \"v1.0.60\"",
      "$DownloadUrl      = \"https://storage.googleapis.com/gridbox-platform.firebasestorage.app/master-images/Gridbox_master_v1.0.60.img.gz\"",
      "try {",
      "    $latestRaw = (Invoke-WebRequest -Uri $LatestJsonUrl -UseBasicParsing -TimeoutSec 10).Content",
      "    $latest = $latestRaw | ConvertFrom-Json",
      "    $ExpectedFilename = $latest.filename",
      "    $ExpectedVersion  = $latest.version",
      "    $DownloadUrl      = $latest.url",
      "    Write-Host \"Verwachte image: $ExpectedFilename ($ExpectedVersion)\" -ForegroundColor Gray",
      "} catch {",
      "    Write-Host \"Kon latest.json niet ophalen, gebruik lokale fallback.\" -ForegroundColor Yellow",
      "    $ExpectedFilename = \"Gridbox_master_v1.0.60.img.gz\"",
      "    $ExpectedVersion  = \"v1.0.60\"",
      "    $DownloadUrl      = \"https://storage.googleapis.com/gridbox-platform.firebasestorage.app/master-images/Gridbox_master_v1.0.60.img.gz\"",
      "}",
      "$ImagePath = \"$env:USERPROFILE\\Downloads\\$ExpectedFilename\"",
      "",
      "if (-not (Test-Path $ImagePath)) {",
      "    $otherImages = @(Get-ChildItem \"$env:USERPROFILE\\Downloads\" -Filter 'Gridbox_master_v*.img.gz' -ErrorAction SilentlyContinue)",
      "    if ($otherImages.Count -gt 0) {",
      "        Write-Host \"\"",
      "        Write-Host \"============================================\" -ForegroundColor Yellow",
      "        Write-Host \"  WAARSCHUWING: Verouderde image gevonden!\" -ForegroundColor Yellow",
      "        Write-Host \"============================================\" -ForegroundColor Yellow",
      "        Write-Host \"\"",
      "        Write-Host \"Gevonden bestand(en) in Downloads:\" -ForegroundColor Yellow",
      "        foreach ($img in $otherImages) { Write-Host \"  $($img.Name)\" -ForegroundColor White }",
      "        Write-Host \"\"",
      "        Write-Host \"Vereiste versie: $ExpectedFilename\" -ForegroundColor Yellow",
      "    } else {",
      "        Write-Host \"\"",
      "        Write-Host \"============================================\" -ForegroundColor Red",
      "        Write-Host \"  FOUT: Master image niet gevonden!\" -ForegroundColor Red",
      "        Write-Host \"============================================\" -ForegroundColor Red",
      "        Write-Host \"\"",
      "        Write-Host \"Verwacht bestand:\" -ForegroundColor Yellow",
      "        Write-Host \"  $ImagePath\" -ForegroundColor White",
      "    }",
      "    Write-Host \"\"",
      "    Write-Host \"Download de juiste versie via:\" -ForegroundColor Yellow",
      "    Write-Host \"  $DownloadUrl\" -ForegroundColor Cyan",
      "    Write-Host \"\"",
      "    Write-Host \"Sla het bestand op in je Downloads map en herstart dit script.\" -ForegroundColor White",
      "    Write-Host \"\"",
      "    Read-Host \"Druk Enter om te sluiten\"",
      "    exit 1",
      "}",
      "",
      "# SD-kaart detectie",
      "$removableDisks = @(Get-Disk | Where-Object { $_.BusType -in @('SD','USB') })",
      "",
      "if ($removableDisks.Count -eq 0) {",
      "    Write-Error \"Geen SD-kaart of USB-opslag gevonden. Sluit de SD-kaartlezer aan en probeer opnieuw.\"",
      "    exit 1",
      "}",
      "",
      "if ($removableDisks.Count -eq 1) {",
      "    $disk = $removableDisks[0]",
      "    Write-Host \"SD-kaart gevonden: $($disk.FriendlyName) ($([math]::Round($disk.Size/1GB, 1)) GB)\" -ForegroundColor White",
      "} else {",
      "    Write-Host \"Meerdere verwisselbare schijven gevonden:\" -ForegroundColor Yellow",
      "    for ($i = 0; $i -lt $removableDisks.Count; $i++) {",
      "        $d = $removableDisks[$i]",
      "        Write-Host \"  [$($i+1)] $($d.FriendlyName) ($([math]::Round($d.Size/1GB, 1)) GB)\"",
      "    }",
      "    $choice = Read-Host \"Welke schijf wil je gebruiken? Voer het nummer in\"",
      "    $idx = [int]$choice - 1",
      "    if ($idx -lt 0 -or $idx -ge $removableDisks.Count) {",
      "        Write-Error \"Ongeldige keuze.\"",
      "        exit 1",
      "    }",
      "    $disk = $removableDisks[$idx]",
      "}",
      "",
      "$diskNumber = $disk.Number",
      "$diskPath   = \"\\\\.\\PhysicalDrive$diskNumber\"",
      "Write-Host \"Flashen naar: $diskPath ($($disk.FriendlyName))\" -ForegroundColor White",
      "",
      "# Cloud-init userdata tijdelijk opslaan",
      `$TempDir = "C:\\Windows\\Temp\\gridbox-${boxId}"`,
      "New-Item -ItemType Directory -Force -Path $TempDir | Out-Null",
      `$CloudInitPath = "$TempDir\\userdata.yaml"`,
      "$CloudInitContent = @'",
      cloudInitUserData,
      "'@",
      "[System.IO.File]::WriteAllText($CloudInitPath, $CloudInitContent, (New-Object System.Text.UTF8Encoding $false))",
      "",
      "# Imager cache wissen zodat de juiste image gebruikt wordt",
      "$cacheDir = \"$env:LOCALAPPDATA\\Raspberry Pi\\Raspberry Pi Imager\\cache\"",
      "if (Test-Path $cacheDir) { Remove-Item \"$cacheDir\\*\" -Force -Recurse -ErrorAction SilentlyContinue }",
      "Write-Host \"Imager cache gewist\"",
      "",
      "# Flash uitvoeren",
      "$imagerArgs = @(",
      "    \"--cli\",",
      "    \"--disable-verify\",",
      "    \"`\"$ImagePath`\"\",",
      "    \"`\"$diskPath`\"\"",
      ")",
      "",
      "Write-Host \"Flashen gestart...\"",
      "$proc = Start-Process -FilePath $ImagerPath -ArgumentList $imagerArgs -Wait -PassThru -NoNewWindow",
      "Write-Host \"rpi-imager klaar met exitcode: $($proc.ExitCode)\"",
      "",
      "if ($proc.ExitCode -ne 0) {",
      "    Write-Host \"FOUT: rpi-imager gaf exitcode $($proc.ExitCode)\" -ForegroundColor Red",
      "    Read-Host \"Druk Enter om te sluiten\"",
      "    exit 1",
      "}",
      "",
      "Write-Host \"Wachten tot Windows de SD-kaart herkent...\"",
      "Start-Sleep -Seconds 20",
      "",
      "Write-Host \"\"",
      "Write-Host \"============================================\" -ForegroundColor Yellow",
      "Write-Host \"  Trek de SD-kaart uit je pc of kaartlezer\" -ForegroundColor Yellow",
      "Write-Host \"  en steek hem er opnieuw in.\" -ForegroundColor Yellow",
      "Write-Host \"  Wacht tot Windows hem herkent.\" -ForegroundColor Yellow",
      "Write-Host \"============================================\" -ForegroundColor Yellow",
      "Write-Host \"\"",
      "Read-Host \"Druk Enter als de SD-kaart terug ingestoken is\"",
      "Start-Sleep -Seconds 5",
      "",
      "# box_bootstrap.json op bootpartitie zetten",
      "$BootstrapJson = @'",
      bootstrapJson,
      "'@",
      "",
      "# Wachten tot bootpartitie gemount is (max 90 seconden)",
      "Write-Host \"Wachten op bootpartitie...\"",
      "$bootDriveLetter = $null",
      "$waited = 0",
      "while ($waited -lt 90) {",
      "    $vol = Get-Volume | Where-Object { $_.FileSystemLabel -in @('bootfs', 'boot') } | Select-Object -First 1",
      "    if ($vol -and $vol.DriveLetter) {",
      "        $bootDriveLetter = $vol.DriveLetter",
      "        Write-Host \"Bootpartitie gevonden via label op ${bootDriveLetter}:\"",
      "        break",
      "    }",
      "    Start-Sleep -Seconds 5",
      "    $waited += 5",
      "}",
      "",
      "# Fallback: zoek FAT32 volume (<1GB, niet C:) als label niet gevonden",
      "if (-not $bootDriveLetter) {",
      "    Write-Host \"Label niet gevonden, probeer FAT32 fallback...\"",
      "    $vol = Get-Volume | Where-Object {",
      "        $_.FileSystem -eq 'FAT32' -and",
      "        $_.DriveLetter -and",
      "        $_.DriveLetter -ne 'C' -and",
      "        $_.Size -lt 1GB",
      "    } | Select-Object -First 1",
      "    if ($vol -and $vol.DriveLetter) {",
      "        $bootDriveLetter = $vol.DriveLetter",
      "        Write-Host \"Bootpartitie gevonden via FAT32 fallback op ${bootDriveLetter}:\"",
      "    }",
      "}",
      "",
      "if (-not $bootDriveLetter) {",
      "    Write-Warning \"Bootpartitie niet automatisch gevonden.\"",
      "    Write-Host \"Beschikbare volumes:\"",
      "    Get-Volume | Where-Object { $_.DriveLetter } | Format-Table DriveLetter, FileSystemLabel, FileSystem, @{L='Grootte';E={[math]::Round($_.Size/1MB)+'MB'}} -AutoSize | Out-String | Write-Host",
      "    $manualLetter = Read-Host \"Voer de stationsletter van de bootpartitie in (bijv. E)\"",
      "    $manualLetter = $manualLetter.Trim().TrimEnd(':').ToUpper()",
      "    if ($manualLetter -match '^[A-Z]$') {",
      "        $bootDriveLetter = $manualLetter",
      "    } else {",
      "        Write-Warning \"Ongeldige stationsletter. box_bootstrap.json wordt NIET geschreven.\"",
      "        Write-Host \"Schrijf het bestand zelf naar de bootpartitie. Inhoud:\"",
      "        Write-Host $BootstrapJson",
      "    }",
      "}",
      "",
      "if ($bootDriveLetter) {",
      "    $BootstrapPath = \"${bootDriveLetter}:\\box_bootstrap.json\"",
      "    [System.IO.File]::WriteAllText($BootstrapPath, $BootstrapJson, (New-Object System.Text.UTF8Encoding $false))",
      "    Write-Host \"box_bootstrap.json geschreven naar $BootstrapPath\"",
      "",
      "    # service-account.json kopiëren naar bootpartitie",
      "    $ServiceAccountSource = Join-Path $ScriptDir 'service-account.json'",
      "    if (Test-Path $ServiceAccountSource) {",
      "        $ServiceAccountDest = \"${bootDriveLetter}:\\service-account.json\"",
      "        Copy-Item $ServiceAccountSource $ServiceAccountDest -Force",
      "        Write-Host \"service-account.json gekopieerd naar $ServiceAccountDest\"",
      "    } else {",
      "        Write-Warning \"service-account.json niet gevonden naast dit script. Kopieer het zelf naar ${bootDriveLetter}:\\service-account.json\"",
      "    }",
      "",
      "    # user-data schrijven naar bootpartitie",
      "    $UserDataPath = \"${bootDriveLetter}:\\user-data\"",
      "    $UserDataContent = @'",
      cloudInitUserData,
      "'@",
      "    [System.IO.File]::WriteAllText($UserDataPath, $UserDataContent, (New-Object System.Text.UTF8Encoding $false))",
      "    Write-Host \"user-data geschreven naar $UserDataPath\"",
      "",
      ...(rpiConnectAuthKey ? [
        "    # rpi-connect auth key op bootpartitie schrijven",
        "    # Op de Pi: /boot/firmware/rpi-connect-auth-key",
        `    [System.IO.File]::WriteAllText("` + "${bootDriveLetter}:\\rpi-connect-auth-key" + `", "` + rpiConnectAuthKey + `", (New-Object System.Text.UTF8Encoding $false))`,
        "    Write-Host \"[RPI Connect] auth key geschreven naar bootpartitie\" -ForegroundColor Green",
        ""
      ] : []),
      "    # meta-data schrijven naar bootpartitie (alleen als het nog niet bestaat)",
      "    $MetaDataPath = \"${bootDriveLetter}:\\meta-data\"",
      "    if (-not (Test-Path $MetaDataPath)) {",
      "        $MetaDataContent = \"instance-id: gridbox-" + boxId + "-" + provisioningId + "`nlocal-hostname: " + boxId + "`n\"",
      "        [System.IO.File]::WriteAllText($MetaDataPath, $MetaDataContent, (New-Object System.Text.UTF8Encoding $false))",
      "        Write-Host \"meta-data geschreven naar $MetaDataPath\"",
      "    } else {",
      "        Write-Host \"meta-data bestaat al, overgeslagen\"",
      "    }",
      "",
      "    # cmdline.txt: dubbele ds=nocloud verwijderen (bewaar alleen de laatste)",
      "    $CmdlinePath = \"${bootDriveLetter}:\\cmdline.txt\"",
      "    if (Test-Path $CmdlinePath) {",
      "        $cmdlineRaw = [System.IO.File]::ReadAllText($CmdlinePath).Trim()",
      "        $cmdlineParts = $cmdlineRaw -split '\\s+'",
      "        $dsIndices = @()",
      "        for ($i = 0; $i -lt $cmdlineParts.Count; $i++) {",
      "            if ($cmdlineParts[$i] -match '^ds=nocloud') { $dsIndices += $i }",
      "        }",
      "        if ($dsIndices.Count -gt 1) {",
      "            $removeSet = [System.Collections.Generic.HashSet[int]]($dsIndices[0..($dsIndices.Count - 2)])",
      "            $filtered = @()",
      "            for ($i = 0; $i -lt $cmdlineParts.Count; $i++) {",
      "                if (-not $removeSet.Contains($i)) { $filtered += $cmdlineParts[$i] }",
      "            }",
      "            [System.IO.File]::WriteAllText($CmdlinePath, ($filtered -join ' '), (New-Object System.Text.UTF8Encoding $false))",
      "            Write-Host \"cmdline.txt: $($dsIndices.Count - 1) dubbele ds=nocloud verwijderd\"",
      "        } else {",
      "            Write-Host \"cmdline.txt: geen dubbele ds=nocloud gevonden\"",
      "        }",
      "    }",
      "",
      "    # === Verificatie ===",
      "    Write-Host \"\"",
      "    Write-Host \"=== Verificatie ===\" -ForegroundColor Cyan",
      "    $allOk = $true",
      "    $check = [char]0x2713",
      "    $cross = [char]0x2717",
      "",
      "    $bsPath = \"${bootDriveLetter}:\\box_bootstrap.json\"",
      "    if (Test-Path $bsPath) {",
      "        $bsBytes = [System.IO.File]::ReadAllBytes($bsPath)",
      "        $hasBom = $bsBytes.Count -ge 3 -and $bsBytes[0] -eq 0xEF -and $bsBytes[1] -eq 0xBB -and $bsBytes[2] -eq 0xBF",
      "        if (-not $hasBom) {",
      "            Write-Host \"  $check box_bootstrap.json aanwezig en geen BOM\" -ForegroundColor Green",
      "        } else {",
      "            Write-Host \"  $cross box_bootstrap.json bevat een BOM\" -ForegroundColor Red",
      "            $allOk = $false",
      "        }",
      "    } else {",
      "        Write-Host \"  $cross box_bootstrap.json niet gevonden\" -ForegroundColor Red",
      "        $allOk = $false",
      "    }",
      "",
      "    try {",
      "        $bsJson = Get-Content $bsPath -Raw | ConvertFrom-Json",
      "        $reqFields = @('boxId','provisioningId','bootstrapToken','apiBaseUrl')",
      "        $fieldsOk = $true",
      "        foreach ($f in $reqFields) { if (-not $bsJson.PSObject.Properties[$f]) { $fieldsOk = $false } }",
      "        if ($fieldsOk) {",
      "            Write-Host \"  $check box_bootstrap.json bevat alle verplichte velden\" -ForegroundColor Green",
      "        } else {",
      "            Write-Host \"  $cross box_bootstrap.json mist verplichte velden\" -ForegroundColor Red",
      "            $allOk = $false",
      "        }",
      "    } catch {",
      "        Write-Host \"  $cross box_bootstrap.json kon niet worden geparsed\" -ForegroundColor Red",
      "        $allOk = $false",
      "    }",
      "",
      "    if (Test-Path \"${bootDriveLetter}:\\service-account.json\") {",
      "        Write-Host \"  $check service-account.json aanwezig\" -ForegroundColor Green",
      "    } else {",
      "        Write-Host \"  $cross service-account.json niet gevonden\" -ForegroundColor Red",
      "        $allOk = $false",
      "    }",
      "",
      "    if (Test-Path \"${bootDriveLetter}:\\user-data\") {",
      "        $udText = Get-Content \"${bootDriveLetter}:\\user-data\" -Raw",
      "        if ($udText -match 'gridbox-bootstrap-init') {",
      "            Write-Host \"  $check user-data aanwezig met gridbox-bootstrap-init\" -ForegroundColor Green",
      "        } else {",
      "            Write-Host \"  $cross user-data mist gridbox-bootstrap-init\" -ForegroundColor Red",
      "            $allOk = $false",
      "        }",
      "    } else {",
      "        Write-Host \"  $cross user-data niet gevonden\" -ForegroundColor Red",
      "        $allOk = $false",
      "    }",
      "",
      "    if (Test-Path \"${bootDriveLetter}:\\meta-data\") {",
      "        Write-Host \"  $check meta-data aanwezig\" -ForegroundColor Green",
      "    } else {",
      "        Write-Host \"  $cross meta-data niet gevonden\" -ForegroundColor Red",
      "        $allOk = $false",
      "    }",
      "",
      "    if (Test-Path \"${bootDriveLetter}:\\cmdline.txt\") {",
      "        $clText = [System.IO.File]::ReadAllText(\"${bootDriveLetter}:\\cmdline.txt\")",
      "        $dsCount = ([regex]::Matches($clText, 'ds=nocloud')).Count",
      "        if ($dsCount -le 1) {",
      "            Write-Host \"  $check cmdline.txt geen dubbele ds=nocloud\" -ForegroundColor Green",
      "        } else {",
      "            Write-Host \"  $cross cmdline.txt heeft $dsCount ds=nocloud vermeldingen\" -ForegroundColor Red",
      "            $allOk = $false",
      "        }",
      "    } else {",
      "        Write-Host \"  $cross cmdline.txt niet gevonden\" -ForegroundColor Red",
      "        $allOk = $false",
      "    }",
      "",
      "    Write-Host \"\"",
      "    if ($allOk) {",
      "        Write-Host \"============================================\" -ForegroundColor Green",
      "        Write-Host \"  VERIFICATIE GESLAAGD\" -ForegroundColor Green",
      "        Write-Host \"  SD-kaart is klaar voor gebruik!\" -ForegroundColor Green",
      "        Write-Host \"  Haal de SD-kaart uit je pc of kaartlezer\" -ForegroundColor Green",
      "        Write-Host \"  en steek hem in de Raspberry Pi.\" -ForegroundColor Green",
      "        Write-Host \"============================================\" -ForegroundColor Green",
      "    } else {",
      "        Write-Host \"============================================\" -ForegroundColor Red",
      "        Write-Host \"  VERIFICATIE MISLUKT\" -ForegroundColor Red",
      "        Write-Host \"  Controleer de fouten hierboven voor gebruik.\" -ForegroundColor Red",
      "        Write-Host \"============================================\" -ForegroundColor Red",
      "    }",
      "}",
      "",
      "Write-Host \"\"",
      "Write-Host \"Druk op Enter om dit venster te sluiten...\" -ForegroundColor Gray",
      "Read-Host",
      "::PS_END"
    ].join("\r\n");

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="gridbox-sd-${boxId}.bat"`);
    return res.status(200).send(script);
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang"
      });
    }

    console.error("FOUT in POST /admin/provisioning/:id/generate-script", error);

    return res.status(500).json({
      error: "GENERATE_SCRIPT_FAILED",
      message: "Script genereren mislukt"
    });
  }
});

router.delete("/admin/provisioning/:id", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const provisioningId = String(req.params?.id || "").trim();
    if (!provisioningId) {
      return res.status(400).json({
        error: "INVALID_PROVISIONING_ID",
        message: "Provisioning id is verplicht"
      });
    }

    const db = getFirestore();
    const provisioningRef = db.collection("provisionings").doc(provisioningId);
    const provisioningSnap = await provisioningRef.get();

    if (!provisioningSnap.exists) {
      return res.status(404).json({
        error: "PROVISIONING_NOT_FOUND",
        message: "Provisioning niet gevonden"
      });
    }

    const data = provisioningSnap.data() as Record<string, unknown>;
    const boxId = typeof data.boxId === "string" ? data.boxId.trim() : "";

    // Delete provisioning document
    await provisioningRef.delete();

    // Delete box and related data if boxId exists
    if (boxId) {
      const boxRef = db.collection("boxes").doc(boxId);

      // Delete subcollections
      const subcollections = ["commands", "shares", "events", "snapshots", "authorizedUsers"];
      for (const sub of subcollections) {
        const subSnap = await boxRef.collection(sub).get();
        if (!subSnap.empty) {
          const batch = db.batch();
          subSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // Delete box document
      await boxRef.delete();

      // Delete customerBoxAccess documents where boxId matches
      const accessSnap = await db
        .collection("customerBoxAccess")
        .where("boxId", "==", boxId)
        .get();
      if (!accessSnap.empty) {
        const batch = db.batch();
        accessSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    return res.json({ ok: true, deleted: { provisioningId, boxId: boxId || null } });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    }

    if (statusCode === 403) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    }

    console.error("FOUT in DELETE /admin/provisioning/:id", error);
    return res.status(500).json({
      error: "DELETE_PROVISIONING_FAILED",
      message: "Kon provisioning niet verwijderen"
    });
  }
});

export default router;
