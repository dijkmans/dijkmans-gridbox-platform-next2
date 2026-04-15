import { Router } from "express";
import { requirePortalUser } from "../auth/verifyBearerToken";
import { getMembershipByEmail } from "../repositories/membershipRepository";
import { getFirestore } from "firebase-admin/firestore";

const router = Router();

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

  if (!membership || membership.role !== "platformAdmin") {
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

      if (existingData.role === "platformAdmin") {
        return res.status(409).json({
          error: "PLATFORM_ADMIN_PROTECTED",
          message: "Bestaande platformAdmin membership kan niet overschreven worden"
        });
      }

      await existingDoc.ref.set(
        {
          email: trimmedEmail,
          customerId: trimmedCustomerId,
          role: trimmedRole,
          updatedAt: new Date().toISOString(),
          updatedBy: context.portalUser.email
        },
        { merge: true }
      );

      return res.json({
        ok: true,
        id: existingDoc.id,
        email: trimmedEmail,
        customerId: trimmedCustomerId,
        role: trimmedRole,
        mode: "updated"
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

export default router;