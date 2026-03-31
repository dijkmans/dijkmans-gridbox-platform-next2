import { Router } from "express";
import { requirePortalUser, verifyBearerToken } from "../auth/verifyBearerToken";
import { mockEventsByBoxId } from "../data/mockData";
import { mapFirestoreBoxToPortalBoxDetail } from "../mappers/boxDetailMapper";
import { mapFirestoreBoxToPortalBox } from "../mappers/boxMapper";
import { getBoxById, listBoxes } from "../repositories/boxRepository";
import { addBoxCommand, getBoxCommandById, getLatestBoxCommand, listBoxCommands } from "../repositories/commandRepository";
import { hasCustomerBoxAccess, listBoxIdsForCustomer } from "../repositories/customerBoxAccessRepository";
import { getCustomerById } from "../repositories/customerRepository";
import { getPlatformBranding } from "../repositories/platformConfigRepository";
import { getMembershipByEmail } from "../repositories/membershipRepository";
import { getSiteById, listSites } from "../repositories/siteRepository";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const router = Router();

const ACTIVE_PORTAL_BOX_IDS = ["gbox-004", "gbox-005"];
const STORAGE_BUCKET_NAME = "gridbox-platform.firebasestorage.app";

function canOperateBox(role?: string | null) {
  return role === "platformAdmin" || role === "customerOperator" || role === "customerOperatorNoCamera";
}

async function readStorageFileContent(storagePath?: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!storagePath) {
    return null;
  }

  const bucket = getStorage().bucket(STORAGE_BUCKET_NAME);
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    return null;
  }

  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();

  return {
    buffer,
    contentType: metadata.contentType || "application/octet-stream"
  };
}

function applyPortalOverrides(box: any) {
  if (box.id === "gbox-005") {
    return {
      ...box,
      displayName: "Gridbox Geel (actief)",
      status: "online",
      connectivitySummary: "Online en operationeel"
    };
  }

  if (box.id === "gbox-004") {
    return {
      ...box,
      displayName: "Gridbox Geel (oud model)",
      status: "offline",
      canOpen: false,
      connectivitySummary: "Niet actief",
      hardwareSummary: "Legacy box",
      availableActions: {
        ...(box.availableActions || {}),
        open: false
      }
    };
  }

  return box;
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

async function requireCustomerContext(email?: string) {
  if (!email) {
    const error = new Error("FORBIDDEN");
    (error as any).statusCode = 403;
    throw error;
  }

  const membership = await getMembershipByEmail(email);

  if (!membership || !membership.customerId) {
    const error = new Error("FORBIDDEN");
    (error as any).statusCode = 403;
    throw error;
  }

  const customer = await getCustomerById(membership.customerId);

  if (!customer || customer.active !== true) {
    const error = new Error("CUSTOMER_INACTIVE");
    (error as any).statusCode = 403;
    throw error;
  }

  return {
    membership,
    customer
  };
}

router.get("/portal/boxes", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);

    console.log("PORTAL BOX LIST REQUEST", {
      user: portalUser,
      customerId: context.membership.customerId
    });

    const [boxDocs, siteDocs, allowedBoxIds, platformBranding] = await Promise.all([
      listBoxes(),
      listSites(),
      listBoxIdsForCustomer(context.membership.customerId!),
      getPlatformBranding()
    ]);

    const allowedSet = new Set(allowedBoxIds);

    const filteredBoxDocs = boxDocs.filter(
      (doc) => allowedSet.has(doc.id)
    );

    const db = getFirestore();

    const shareSummaryEntries = await Promise.all(
      filteredBoxDocs.map(async (doc) => {
        const boxId = typeof doc.data?.boxId === "string" && doc.data.boxId.trim().length > 0
          ? doc.data.boxId.trim()
          : doc.id;

        const snapshot = await db.collection("boxes").doc(boxId).collection("shares").get();

        const activePhoneNumbers = snapshot.docs
          .map((shareDoc) => {
            const data = shareDoc.data() as Record<string, any>;
            const shareId = shareDoc.id;
            const active = data.active === true || data.status === "active";

            if (!active) {
              return null;
            }

            if (!/^\+\d{8,20}$/.test(shareId)) {
              return null;
            }

            return shareId;
          })
          .filter((value): value is string => typeof value === "string")
          .sort((a, b) => a.localeCompare(b));

        return [
          boxId,
          {
            totalActive: activePhoneNumbers.length,
            phoneNumbers: activePhoneNumbers.slice(0, 2)
          }
        ] as const;
      })
    );

    const shareSummaryByBoxId = new Map(shareSummaryEntries);

    const items = filteredBoxDocs
      .map((doc) => {
        const mapped = mapFirestoreBoxToPortalBox(doc, siteDocs);

        return {
          ...mapped,
          shareSummary: shareSummaryByBoxId.get(mapped.id) || {
            totalActive: 0,
            phoneNumbers: []
          }
        };
      })
      .map(applyPortalOverrides);

    return res.json({
      items,
      count: items.length,
      mode: "firestore",
      branding: {
        footerText: platformBranding?.footerText || "Powered by Gridbox"
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
        message: "Je hebt geen toegang tot het portaal"
      });
    }

    console.error("FOUT in /portal/boxes", error);

    return res.status(500).json({
      error: "BOX_LIST_FAILED",
      message: "Kon boxen niet ophalen"
    });
  }
});

router.get("/portal/boxes/:id", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;

    console.log("PORTAL BOX DETAIL REQUEST", {
      boxId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    const rawSiteId =
      typeof boxDoc.data.siteId === "string" && boxDoc.data.siteId.trim().length > 0
        ? boxDoc.data.siteId.trim()
        : null;

    const siteDoc = rawSiteId ? await getSiteById(rawSiteId) : null;

    const detail = applyPortalOverrides(
      mapFirestoreBoxToPortalBoxDetail(boxDoc, siteDoc || undefined)
    );

    return res.json({
      ...detail,
      mode: "firestore"
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in /portal/boxes/:id", error);

    return res.status(500).json({
      error: "BOX_DETAIL_FAILED",
      message: "Kon boxdetail niet ophalen"
    });
  }
});

router.get("/portal/boxes/:id/shares", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;

    console.log("PORTAL BOX SHARES REQUEST", {
      boxId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    const db = getFirestore();
    const snapshot = await db.collection("boxes").doc(boxId).collection("shares").get();

    const items = snapshot.docs
      .map((doc) => {
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
          label: typeof data.name === "string" ? data.name : null,
          email: typeof data.email === "string" ? data.email : null,
          role: typeof data.role === "string" ? data.role : null,
          addedBy: typeof data.addedBy === "string" ? data.addedBy : null,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : null
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in /portal/boxes/:id/shares", error);

    return res.status(500).json({
      error: "BOX_SHARES_FAILED",
      message: "Kon shares niet ophalen"
    });
  }
});

router.post("/portal/boxes/:id/shares", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;
    const { phoneNumber, label, status } = req.body ?? {};

    console.log("PORTAL BOX CREATE SHARE REQUEST", {
      boxId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    if (typeof phoneNumber !== "string" || phoneNumber.trim().length === 0) {
      return res.status(400).json({
        error: "INVALID_PHONE_NUMBER",
        message: "Gsm-nummer is verplicht"
      });
    }

    const normalizedPhoneNumber = phoneNumber.trim();

    if (!/^\+\d{8,20}$/.test(normalizedPhoneNumber)) {
      return res.status(400).json({
        error: "INVALID_PHONE_NUMBER",
        message: "Gebruik een gsm-nummer in internationaal formaat, bv +32471234567"
      });
    }

    const normalizedLabel =
      typeof label === "string" && label.trim().length > 0
        ? label.trim()
        : "";

    const db = getFirestore();
    const shareRef = db.collection("boxes").doc(boxId).collection("shares").doc(normalizedPhoneNumber);
    const existingShare = await shareRef.get();

    if (existingShare.exists) {
      return res.status(409).json({
        error: "SHARE_ALREADY_EXISTS",
        message: "Voor dit gsm-nummer bestaat al een actieve of bestaande share"
      });
    }

    const normalizedStatus = status === "active" ? "active" : "pending";
    const isActiveShare = normalizedStatus === "active";

    await shareRef.set({
      name: normalizedLabel,
      status: normalizedStatus,
      active: isActiveShare,
      createdAt: new Date().toISOString(),
      addedBy: portalUser.email || "portal-user"
    });

    return res.json({
      ok: true,
      boxId,
      phoneNumber: normalizedPhoneNumber,
      label: normalizedLabel || null,
      status: normalizedStatus
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in POST /portal/boxes/:id/shares", error);

    return res.status(500).json({
      error: "BOX_SHARE_CREATE_FAILED",
      message: "Kon share niet aanmaken"
    });
  }
});

// --- NIEUWE ROUTE: ACTIVEREN VAN EEN SHARE (De koerier / staged delivery) ---
router.put("/portal/boxes/:id/shares/:shareId/activate", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;
    const shareId = req.params.shareId;

    console.log("PORTAL BOX ACTIVATE SHARE REQUEST (COURIER DROP)", {
      boxId,
      shareId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);
    if (!hasAccess) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Geen toegang" });
    }

    const boxDoc = await getBoxById(boxId);
    if (!boxDoc) {
      return res.status(404).json({ error: "BOX_NOT_FOUND", message: "Box niet gevonden" });
    }

    const db = getFirestore();
    const shareRef = db.collection("boxes").doc(boxId).collection("shares").doc(shareId);
    const existingShare = await shareRef.get();

    if (!existingShare.exists) {
      return res.status(404).json({ error: "SHARE_NOT_FOUND", message: "Share niet gevonden" });
    }

    const shareData = existingShare.data() as Record<string, any>;
    // ROBUUSTHEIDSCHECK: Alleen pending shares kunnen geactiveerd worden
    if (shareData.status !== "pending") {
      return res.status(409).json({
        error: "ALREADY_ACTIVE",
        message: "Dit gsm-nummer is al actief of niet klaargezet"
      });
    }

    // --- DE ACTIE: Status aanpassen naar ACTIEF ---
    await shareRef.update({
      status: "active", // This triggers the SMS via backend logic
      active: true,   // Important to set true explicitly in Firestore
      activatedAt: new Date().toISOString(),
      activatedBy: portalUser.email || "courier-portal"
    });

    // --- DE SMS-TRIGGER (Toekomstige stap) ---
    // Voorlopig simuleren we de trigger met een console.log.
    // Dit is de plek waar je de daadwerkelijke SMS-service zou aanroepen.
    console.log(`[SMS TRIGGER] Share activated and SMS sent to +${shareId} for Gridbox ${boxId}.`);

    return res.json({
      ok: true,
      boxId,
      shareId,
      status: "active"
    });

  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen toegang" });
    console.error("FOUT in PUT /portal/boxes/:id/shares/:shareId/activate", error);
    return res.status(500).json({ error: "SHARE_ACTIVATE_FAILED", message: "Kon share niet activeren" });
  }
});
// -------------------------------------------------------------------------

router.delete("/portal/boxes/:id/shares/:shareId", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;
    const shareId = req.params.shareId;

    console.log("PORTAL BOX DELETE SHARE REQUEST", {
      boxId,
      shareId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    const db = getFirestore();
    const shareRef = db.collection("boxes").doc(boxId).collection("shares").doc(shareId);
    const existingShare = await shareRef.get();

    if (!existingShare.exists) {
      return res.status(404).json({
        error: "SHARE_NOT_FOUND",
        message: "Share niet gevonden"
      });
    }

    await shareRef.delete();

    return res.json({
      ok: true,
      boxId,
      shareId,
      deleted: true
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in DELETE /portal/boxes/:id/shares/:shareId", error);

    return res.status(500).json({
      error: "BOX_SHARE_DELETE_FAILED",
      message: "Kon share niet verwijderen"
    });
  }
});

router.get("/portal/boxes/:id/commands/latest", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;

    console.log("PORTAL BOX LATEST COMMAND REQUEST", {
      boxId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const latest = await getLatestBoxCommand(boxId);

    if (!latest) {
      return res.status(404).json({
        error: "COMMAND_NOT_FOUND",
        message: "Geen command gevonden"
      });
    }

    return res.json({
      id: latest.id,
      ...latest.data
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in /portal/boxes/:id/commands/latest", error);

    return res.status(500).json({
      error: "LATEST_COMMAND_FAILED",
      message: "Kon laatste command niet ophalen"
    });
  }
});

router.get("/portal/boxes/:id/commands/:commandId", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;
    const commandId = req.params.commandId;

    console.log("PORTAL BOX COMMAND REQUEST", {
      boxId,
      commandId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const command = await getBoxCommandById(boxId, commandId);

    if (!command) {
      return res.status(404).json({
        error: "COMMAND_NOT_FOUND",
        message: "Command niet gevonden"
      });
    }

    return res.json({
      id: command.id,
      ...command.data
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in /portal/boxes/:id/commands/:commandId", error);

    return res.status(500).json({
      error: "COMMAND_FETCH_FAILED",
      message: "Kon command niet ophalen"
    });
  }
});

router.get("/portal/boxes/:id/events", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;

    console.log("PORTAL BOX EVENTS REQUEST", {
      boxId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const db = getFirestore();
    const [commands, snapshotsSnap, mockEvents] = await Promise.all([
      listBoxCommands(boxId, 20),
      db.collection("boxes").doc(boxId).collection("snapshots")
        .orderBy("capturedAt", "desc")
        .limit(50)
        .get(),
      Promise.resolve(mockEventsByBoxId[boxId] || [])
    ]);

    const allSnapshots = snapshotsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const commandItems = commands.map((item) => {
      const command = typeof item.data.command === "string" ? item.data.command : "UNKNOWN";
      const status = typeof item.data.status === "string" ? item.data.status : "unknown";
      const source = typeof item.data.source === "string" ? item.data.source : "Onbekende bron";
      const timestamp = typeof item.data.createdAt === "string" ? item.data.createdAt : new Date().toISOString();

      const relatedPhotos = allSnapshots.filter((snap: any) => {
        const snapTime = new Date(snap.capturedAt).getTime();
        const cmdTime = new Date(timestamp).getTime();
        return snapTime >= (cmdTime - 60000) && snapTime <= (cmdTime + 900000);
      });

      return {
        id: `cmd-${item.id}`,
        type: `command_${command.toLowerCase()}`,
        timestamp,
        label: `${command} via ${source} (${status})`,
        severity: status === "failed" ? "error" : "info",
        photos: relatedPhotos,
        hasPhotos: relatedPhotos.length > 0
      };
    });

    const items = [...commandItems, ...mockEvents].sort((a, b) =>
      String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
    );

    return res.json({
      items,
      count: items.length,
      mode: "live-with-photos"
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in /portal/boxes/:id/events", error);

    return res.status(500).json({
      error: "EVENTS_FAILED",
      message: "Kon events niet ophalen"
    });
  }
});

router.post("/portal/boxes/:id/open", async (req, res) => {
  try {
    const boxId = req.params.id;
    const portalUser = await verifyBearerToken(req.header("Authorization") || undefined);

    console.log("PORTAL OPEN REQUEST", {
      boxId,
      user: portalUser || null
    });

    if (!portalUser) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    const context = await requireCustomerContext(portalUser.email);

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    if (!canOperateBox(context.membership.role)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang om deze box te openen"
      });
    }

    if (!ACTIVE_PORTAL_BOX_IDS.includes(boxId)) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    if (boxId === "gbox-004") {
      return res.status(403).json({
        error: "OPEN_NOT_ALLOWED",
        message: "Open-actie niet toegelaten"
      });
    }

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    const commandId = await addBoxCommand(boxId, "OPEN", "Web Dashboard");

    return res.json({
      ok: true,
      boxId,
      commandId,
      action: "OPEN",
      acceptedAt: new Date().toISOString(),
      mode: "firestore",
      requestedBy: portalUser.email,
      customerId: context.membership.customerId
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in POST /portal/boxes/:id/open", error);

    return res.status(500).json({
      error: "OPEN_COMMAND_FAILED",
      message: "Kon open-commando niet opslaan"
    });
  }
});


router.post("/portal/boxes/:id/close", async (req, res) => {
  try {
    const boxId = req.params.id;
    const portalUser = await verifyBearerToken(req.header("Authorization") || undefined);

    console.log("PORTAL CLOSE REQUEST", {
      boxId,
      user: portalUser || null
    });

    if (!portalUser) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld"
      });
    }

    const context = await requireCustomerContext(portalUser.email);

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    if (!canOperateBox(context.membership.role)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang om deze box te sluiten"
      });
    }

    if (!ACTIVE_PORTAL_BOX_IDS.includes(boxId)) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    if (boxId === "gbox-004") {
      return res.status(403).json({
        error: "CLOSE_NOT_ALLOWED",
        message: "Close-actie niet toegelaten"
      });
    }

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    const commandId = await addBoxCommand(boxId, "CLOSE", "Web Dashboard");

    return res.json({
      ok: true,
      boxId,
      commandId,
      action: "CLOSE",
      acceptedAt: new Date().toISOString(),
      mode: "firestore",
      requestedBy: portalUser.email,
      customerId: context.membership.customerId
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in POST /portal/boxes/:id/close", error);

    return res.status(500).json({
      error: "CLOSE_COMMAND_FAILED",
      message: "Kon close-commando niet opslaan"
    });
  }
});

router.get("/portal/boxes/:id/snapshots", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const limit = parseInt(req.query.limit as string) || 40;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const phase = req.query.phase as string;

    const db = getFirestore();
    let query: any = db.collection("boxes").doc(boxId).collection("snapshots")
      .orderBy("capturedAt", "desc");

    if (startDate) {
      query = query.where("capturedAt", ">=", startDate);
    }
    if (endDate) {
      query = query.where("capturedAt", "<=", endDate);
    }
    if (phase) {
      query = query.where("phase", "==", phase);
    }

    const snapshotDocs = await query.limit(limit).get();

    const items = snapshotDocs.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({
      boxId,
      items,
      count: items.length,
      mode: "firestore-snapshots"
    });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen toegang" });

    console.error("FOUT in GET /portal/boxes/:id/snapshots", error);
    return res.status(500).json({ error: "SNAPSHOTS_FETCH_FAILED", message: "Kon snapshots niet ophalen" });
  }
});

router.get("/portal/boxes/:id/photos", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const boxId = req.params.id;

    console.log("PORTAL BOX PHOTOS REQUEST", {
      boxId,
      user: portalUser,
      customerId: context.membership.customerId
    });

    const hasAccess = await hasCustomerBoxAccess(context.membership.customerId!, boxId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Je hebt geen toegang tot deze box"
      });
    }

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    const bucket = getStorage().bucket("gridbox-platform.firebasestorage.app");
    const prefix = `snapshots/${boxId}/`;

    const [files] = await bucket.getFiles({ prefix });

    const items = files
      .filter((file) => typeof file.name === "string" && !file.name.endsWith("/"))
      .map((file) => {
        const metadata = file.metadata || {};
        const parts = file.name.split("/");
        const filename = parts[parts.length - 1] || file.name;

        return {
          id: file.name,
          filename,
          storagePath: file.name,
          updatedAt: typeof metadata.updated === "string" ? metadata.updated : null,
          size: typeof metadata.size === "string" ? metadata.size : null,
          contentType: typeof metadata.contentType === "string" ? metadata.contentType : null
        };
      })
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 100);

    return res.json({
      boxId,
      items,
      count: items.length,
      mode: "storage"
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
        message: "Je hebt geen toegang tot deze box"
      });
    }

    console.error("FOUT in GET /portal/boxes/:id/photos", error);

    return res.status(500).json({
      error: "PHOTOS_FETCH_FAILED",
      message: "Kon foto's niet ophalen"
    });
  }
});

router.get("/portal/boxes/:id/photos/content", async (req, res) => {
  try {
    const boxId = req.params.id;
    const filename = typeof req.query.filename === "string" ? req.query.filename.trim() : "";

    console.log("PORTAL BOX PHOTO CONTENT REQUEST", {
      boxId,
      filename
    });

    if (!filename) {
      return res.status(400).json({
        error: "INVALID_FILENAME",
        message: "Bestandsnaam is verplicht"
      });
    }

    if (filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({
        error: "INVALID_FILENAME",
        message: "Ongeldige bestandsnaam"
      });
    }

    const bucket = getStorage().bucket("gridbox-platform.firebasestorage.app");
    const file = bucket.file(`snapshots/${boxId}/${filename}`);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).json({
        error: "PHOTO_NOT_FOUND",
        message: "Foto niet gevonden"
      });
    }

    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();

    res.setHeader("Content-Type", metadata.contentType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("FOUT in GET /portal/boxes/:id/photos/content", error);

    return res.status(500).json({
      error: "PHOTO_CONTENT_FAILED",
      message: "Kon foto niet ophalen"
    });
  }
});

router.get("/portal/boxes/:id/picture", async (req, res) => {
  try {
    const boxId = req.params.id;

    console.log("PORTAL BOX PICTURE REQUEST (LATEST LIVE PREVIEW)", {
      boxId
    });

    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box niet gevonden"
      });
    }

    const bucket = getStorage().bucket("gridbox-platform.firebasestorage.app");
    const prefix = `snapshots/${boxId}/`;

    const [files] = await bucket.getFiles({ prefix });

    const validFiles = files.filter(f => !f.name.endsWith("/"));

    if (validFiles.length === 0) {
       return res.status(404).json({
        error: "NO_PICTURES_YET",
        message: "Er zijn nog geen foto's beschikbaar"
      });
    }

    validFiles.sort((a, b) => {
      const timeA = new Date(a.metadata.updated || 0).getTime();
      const timeB = new Date(b.metadata.updated || 0).getTime();
      return timeB - timeA;
    });

    const latestFile = validFiles[0];
    const [metadata] = await latestFile.getMetadata();
    const [buffer] = await latestFile.download();

    res.setHeader("Content-Type", metadata.contentType || "image/jpeg");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return res.status(200).send(buffer);

  } catch (error) {
    console.error("FOUT in GET /portal/boxes/:id/picture", error);
    return res.status(500).json({
      error: "PICTURE_FETCH_FAILED",
      message: "Kon picture niet ophalen"
    });
  }
});

router.get("/portal/assets/gridbox-logo", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    await requireCustomerContext(portalUser.email);

    const branding = await getPlatformBranding();
    const fileData = await readStorageFileContent(branding?.gridboxLogoPath);

    if (!fileData) {
      return res.status(404).json({
        error: "GRIDBOX_LOGO_NOT_FOUND",
        message: "Gridbox-logo niet gevonden"
      });
    }

    res.setHeader("Content-Type", fileData.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(fileData.buffer);
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
        message: "Je hebt geen toegang tot het portaal"
      });
    }

    console.error("FOUT in GET /portal/assets/gridbox-logo", error);

    return res.status(500).json({
      error: "GRIDBOX_LOGO_FETCH_FAILED",
      message: "Kon Gridbox-logo niet ophalen"
    });
  }
});

router.get("/portal/assets/gridbox-footer-logo", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    await requireCustomerContext(portalUser.email);

    const branding = await getPlatformBranding();
    const fileData = await readStorageFileContent(branding?.gridboxFooterLogoPath);

    if (!fileData) {
      return res.status(404).json({
        error: "GRIDBOX_FOOTER_LOGO_NOT_FOUND",
        message: "Gridbox-footerlogo niet gevonden"
      });
    }

    res.setHeader("Content-Type", fileData.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(fileData.buffer);
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
        message: "Je hebt geen toegang tot het portaal"
      });
    }

    console.error("FOUT in GET /portal/assets/gridbox-footer-logo", error);

    return res.status(500).json({
      error: "GRIDBOX_FOOTER_LOGO_FETCH_FAILED",
      message: "Kon Gridbox-footerlogo niet ophalen"
    });
  }
});

router.get("/portal/assets/customer-logo", async (req, res) => {
  try {
    const portalUser = await requirePortalUser(req.header("Authorization") || undefined);
    const context = await requireCustomerContext(portalUser.email);
    const fileData = await readStorageFileContent(context.customer.logoPath);

    if (!fileData) {
      return res.status(404).json({
        error: "CUSTOMER_LOGO_NOT_FOUND",
        message: "Klantlogo niet gevonden"
      });
    }

    res.setHeader("Content-Type", fileData.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(fileData.buffer);
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
        message: "Je hebt geen toegang tot het portaal"
      });
    }

    console.error("FOUT in GET /portal/assets/customer-logo", error);

    return res.status(500).json({
      error: "CUSTOMER_LOGO_FETCH_FAILED",
      message: "Kon klantlogo niet ophalen"
    });
  }
});

export default router;


