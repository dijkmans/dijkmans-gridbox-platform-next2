import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import { requirePortalUser } from "../auth/verifyBearerToken";
import { getMembershipByEmail } from "../repositories/membershipRepository";
import { getFirestore } from "firebase-admin/firestore";

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
      "awaiting_sd_preparation",
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

    await provisioningRef.set(provisioningRecord);

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

export default router;
