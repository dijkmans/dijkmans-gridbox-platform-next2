import crypto from "crypto";
import express, { Response } from "express";
import type { Request } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { requirePortalUser } from "../auth/verifyBearerToken";
import { getMembershipByEmail } from "../repositories/membershipRepository";
import { hashInviteToken, generateInviteToken, buildInviteUrl } from "../utils/inviteTokens";
import { sendBirdSms } from "../services/birdSms";
import type {
  CreateInviteInput,
  ValidateInviteInput,
  AcceptInviteInput,
} from "../types/invite";
import {
  requireFirebaseUser,
  AuthenticatedRequest,
} from "../middleware/requireFirebaseUser";

const router = express.Router();

const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const PHONE_CODE_LENGTH = 6;
const PHONE_CODE_TTL_MINUTES = 10;
const PHONE_CODE_MAX_ATTEMPTS = 5;
const PHONE_CODE_RESEND_SECONDS = 60;

const ASSIGNABLE_CUSTOMER_ROLES = [
  "customerOperator",
  "customerOperatorNoCamera",
  "customerViewer",
] as const;

function isAssignableCustomerRole(value: unknown): value is (typeof ASSIGNABLE_CUSTOMER_ROLES)[number] {
  return typeof value === "string" && ASSIGNABLE_CUSTOMER_ROLES.includes(value as any);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
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

function parseInviteExpiry(value: any): Date | null {
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  const date = new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function generatePhoneCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashPhoneCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
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
    membership,
  };
}

async function findInviteByTokenHash(tokenHash: string) {
  const db = getFirestore();

  const inviteSnapshot = await db
    .collection("invites")
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (inviteSnapshot.empty) {
    return null;
  }

  const inviteDoc = inviteSnapshot.docs[0];
  const invite = inviteDoc.data() as Record<string, any>;
  return { inviteDoc, invite };
}

function validateInviteState(invite: Record<string, any>, inviteDocId: string) {
  const expiresAt = parseInviteExpiry(invite.expiresAt);

  if (invite.status === "revoked") {
    return {
      ok: false as const,
      status: 410,
      body: {
        error: "INVITE_REVOKED",
        message: "Invite is ingetrokken",
      },
    };
  }

  if (invite.status === "accepted") {
    return {
      ok: false as const,
      status: 409,
      body: {
        error: "INVITE_ALREADY_USED",
        message: "Invite is al gebruikt",
      },
    };
  }

  if (!expiresAt) {
    return {
      ok: false as const,
      status: 500,
      body: {
        error: "INVITE_INVALID_EXPIRY",
        message: "Invite heeft geen geldige vervaldatum",
      },
    };
  }

  if (expiresAt.getTime() < Date.now() || invite.status === "expired") {
    return {
      ok: false as const,
      status: 410,
      body: {
        error: "INVITE_EXPIRED",
        message: "Invite is vervallen",
      },
    };
  }

  return {
    ok: true as const,
    expiresAt,
    inviteDocId,
  };
}

router.post("/admin/invites", async (req: Request, res: Response) => {
  try {
    const context = await requirePlatformAdmin(req.header("Authorization") || undefined);

    const body = req.body as CreateInviteInput;
    const email = normalizeEmail(body.email || "");

    if (!email || !body.customerId || !body.role) {
      return res.status(400).json({ error: "INVALID_INPUT" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "INVALID_EMAIL",
        message: "Vul een geldig e-mailadres in",
      });
    }

    if (!isAssignableCustomerRole(body.role)) {
      return res.status(400).json({
        error: "INVALID_ROLE",
        message: "Ongeldige klantrol voor invite",
      });
    }

    const db = getFirestore();

    const existingSnapshot = await db
      .collection("invites")
      .where("customerId", "==", body.customerId)
      .where("email", "==", email)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return res.status(409).json({
        error: "INVITE_ALREADY_PENDING",
        message: "Er bestaat al een pending invite voor deze klant en dit e-mailadres",
      });
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);

    const now = new Date();
    const expiresAt = addDays(now, DEFAULT_INVITE_EXPIRY_DAYS);
    const portalBaseUrl = process.env.PORTAL_BASE_URL || "https://gridbox-platform.web.app";
    const inviteUrl = buildInviteUrl(portalBaseUrl, rawToken);

    const inviteRef = db.collection("invites").doc();

    await inviteRef.set({
      email,
      displayName: body.displayName || null,
      customerId: body.customerId,
      role: body.role,
      scope: body.scope || {},
      createdByAuthUid: context.portalUser.uid,
      tokenHash,
      expiresAt,
      status: "pending",
      createdAt: now,
      acceptedAt: null,
      acceptedByAuthUid: null,
      phoneNumber: null,
      phoneVerified: false,
      phoneVerification: {
        status: "not_started",
        codeHash: null,
        expiresAt: null,
        attemptCount: 0,
        lastSentAt: null,
      },
    });

    return res.status(201).json({
      success: true,
      inviteId: inviteRef.id,
      invite: {
        email,
        customerId: body.customerId,
        role: body.role,
        scope: body.scope || {},
        expiresAt: expiresAt.toISOString(),
        status: "pending",
      },
      inviteUrl,
      emailDelivery: "manual",
      message: "Invite aangemaakt. Er werd geen e-mail verstuurd. Stuur de activatielink zelf via mail.",
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld",
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang",
      });
    }

    console.error("POST /admin/invites error", error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.delete("/admin/invites/:inviteId", async (req: Request, res: Response) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const inviteId = String(req.params?.inviteId || "").trim();

    if (!inviteId) {
      return res.status(400).json({
        error: "INVALID_INVITE_ID",
        message: "InviteId is verplicht",
      });
    }

    const db = getFirestore();
    const inviteRef = db.collection("invites").doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return res.status(404).json({
        error: "INVITE_NOT_FOUND",
        message: "Invite niet gevonden",
      });
    }

    const invite = inviteSnap.data() as Record<string, any>;

    if (invite.status === "accepted") {
      return res.status(409).json({
        error: "INVITE_ALREADY_ACCEPTED",
        message: "Deze invite is al geaccepteerd en kan niet meer verwijderd worden",
      });
    }

    await inviteRef.delete();

    return res.status(200).json({
      success: true,
      inviteId,
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Niet aangemeld",
      });
    }

    if (statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Geen admin-toegang",
      });
    }

    console.error("DELETE /admin/invites/:inviteId error", error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});
router.post("/invites/validate", async (req: Request, res: Response) => {
  try {
    const body = req.body as ValidateInviteInput;

    if (!body.token) {
      return res.status(400).json({ error: "INVALID_INPUT" });
    }

    const tokenHash = hashInviteToken(body.token);
    const found = await findInviteByTokenHash(tokenHash);

    if (!found) {
      return res.status(404).json({
        error: "INVITE_NOT_FOUND",
        message: "Invite niet gevonden",
      });
    }

    const { inviteDoc, invite } = found;
    const state = validateInviteState(invite, inviteDoc.id);

    if (!state.ok) {
      return res.status(state.status).json(state.body);
    }

    return res.status(200).json({
      valid: true,
      inviteId: inviteDoc.id,
      email: invite.email || null,
      displayName: invite.displayName || null,
      customerId: invite.customerId || null,
      role: invite.role || null,
      scope: invite.scope || {},
      expiresAt: state.expiresAt.toISOString(),
      status: invite.status,
      phoneVerified: invite.phoneVerified === true,
      phoneNumber: invite.phoneNumber || null,
      phoneVerificationStatus: invite.phoneVerification?.status || "not_started",
    });
  } catch (error) {
    console.error("POST /invites/validate error", error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/invites/send-phone-code", async (req: Request, res: Response) => {
  try {
    const token = String(req.body?.token || "");
    const phoneNumber = normalizePhone(String(req.body?.phoneNumber || ""));

    if (!token || !phoneNumber) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Token en gsm-nummer zijn verplicht",
      });
    }

    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({
        error: "INVALID_PHONE",
        message: "Vul een geldig gsm-nummer in in internationaal formaat",
      });
    }

    const tokenHash = hashInviteToken(token);
    const found = await findInviteByTokenHash(tokenHash);

    if (!found) {
      return res.status(404).json({
        error: "INVITE_NOT_FOUND",
        message: "Invite niet gevonden",
      });
    }

    const { inviteDoc, invite } = found;
    const state = validateInviteState(invite, inviteDoc.id);

    if (!state.ok) {
      return res.status(state.status).json(state.body);
    }

    const lastSentAt = parseInviteExpiry(invite.phoneVerification?.lastSentAt);
    if (lastSentAt && Date.now() - lastSentAt.getTime() < PHONE_CODE_RESEND_SECONDS * 1000) {
      return res.status(429).json({
        error: "PHONE_CODE_TOO_SOON",
        message: "Wacht even voor je een nieuwe code vraagt",
      });
    }

    const code = generatePhoneCode();
    const codeHash = hashPhoneCode(code);
    const now = new Date();
    const expiresAt = addMinutes(now, PHONE_CODE_TTL_MINUTES);

    await sendBirdSms(
      phoneNumber,
      `Je verificatiecode voor Gridbox is ${code}. Deze code is ${PHONE_CODE_TTL_MINUTES} minuten geldig.`,
      { trigger: "invite-verificatie" }
    );

    await inviteDoc.ref.update({
      phoneNumber,
      phoneVerified: false,
      phoneVerification: {
        status: "code_sent",
        codeHash,
        expiresAt,
        attemptCount: 0,
        lastSentAt: now,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Verificatiecode verzonden",
      phoneVerificationStatus: "code_sent",
    });
  } catch (error) {
    console.error("POST /invites/send-phone-code error", error);
    return res.status(500).json({
      error: "PHONE_CODE_SEND_FAILED",
      message: "Kon verificatiecode niet versturen",
    });
  }
});

router.post("/invites/verify-phone-code", async (req: Request, res: Response) => {
  try {
    const token = String(req.body?.token || "");
    const code = String(req.body?.code || "").trim();

    if (!token || !code) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Token en code zijn verplicht",
      });
    }

    const tokenHash = hashInviteToken(token);
    const found = await findInviteByTokenHash(tokenHash);

    if (!found) {
      return res.status(404).json({
        error: "INVITE_NOT_FOUND",
        message: "Invite niet gevonden",
      });
    }

    const { inviteDoc, invite } = found;
    const state = validateInviteState(invite, inviteDoc.id);

    if (!state.ok) {
      return res.status(state.status).json(state.body);
    }

    const verification = invite.phoneVerification || {};
    const expiresAt = parseInviteExpiry(verification.expiresAt);
    const attemptCount = Number(verification.attemptCount || 0);

    if (!verification.codeHash || !expiresAt) {
      return res.status(400).json({
        error: "PHONE_CODE_NOT_SENT",
        message: "Er werd nog geen verificatiecode verstuurd",
      });
    }

    if (attemptCount >= PHONE_CODE_MAX_ATTEMPTS) {
      return res.status(429).json({
        error: "PHONE_CODE_TOO_MANY_ATTEMPTS",
        message: "Te veel foutieve pogingen",
      });
    }

    if (expiresAt.getTime() < Date.now()) {
      return res.status(410).json({
        error: "PHONE_CODE_EXPIRED",
        message: "De verificatiecode is vervallen",
      });
    }

    const submittedHash = hashPhoneCode(code);

    if (submittedHash !== verification.codeHash) {
      await inviteDoc.ref.update({
        "phoneVerification.attemptCount": attemptCount + 1,
        "phoneVerification.status": "code_sent",
      });

      return res.status(400).json({
        error: "PHONE_CODE_INVALID",
        message: "De verificatiecode klopt niet",
      });
    }

    await inviteDoc.ref.update({
      phoneVerified: true,
      "phoneVerification.status": "verified",
      "phoneVerification.codeHash": null,
      "phoneVerification.expiresAt": null,
      "phoneVerification.attemptCount": attemptCount,
    });

    return res.status(200).json({
      success: true,
      message: "Gsm-nummer geverifieerd",
      phoneVerified: true,
    });
  } catch (error) {
    console.error("POST /invites/verify-phone-code error", error);
    return res.status(500).json({
      error: "PHONE_CODE_VERIFY_FAILED",
      message: "Kon verificatiecode niet controleren",
    });
  }
});

router.post(
  "/invites/accept",
  requireFirebaseUser,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as AcceptInviteInput;

      if (!body.token) {
        return res.status(400).json({ error: "INVALID_INPUT" });
      }

      if (!req.user?.uid) {
        return res.status(401).json({ error: "AUTH_REQUIRED" });
      }

      const tokenHash = hashInviteToken(body.token);
      const found = await findInviteByTokenHash(tokenHash);

      if (!found) {
        return res.status(404).json({
          error: "INVITE_NOT_FOUND",
          message: "Invite niet gevonden",
        });
      }

      const { inviteDoc, invite } = found;
      const state = validateInviteState(invite, inviteDoc.id);

      if (!state.ok) {
        return res.status(state.status).json(state.body);
      }

      const inviteEmail = normalizeEmail(invite.email || "");
      const authEmail = normalizeEmail(req.user.email || "");

      if (!inviteEmail || !authEmail || inviteEmail !== authEmail) {
        return res.status(403).json({
          error: "EMAIL_MISMATCH",
          message: "Ingelogd e-mailadres komt niet overeen met de invite",
        });
      }

      if (invite.phoneVerified !== true || !invite.phoneNumber) {
        return res.status(400).json({
          error: "PHONE_NOT_VERIFIED",
          message: "Geen geverifieerd gsm-nummer beschikbaar",
        });
      }

      const db = getFirestore();

      const existingByInvite = await db
        .collection("memberships")
        .where("inviteId", "==", inviteDoc.id)
        .limit(1)
        .get();

      if (!existingByInvite.empty) {
        return res.status(409).json({
          error: "MEMBERSHIP_ALREADY_EXISTS",
          message: "Voor deze invite bestaat al een membership",
        });
      }

      const existingActiveMembership = await db
        .collection("memberships")
        .where("authUid", "==", req.user.uid)
        .where("customerId", "==", invite.customerId || null)
        .where("active", "==", true)
        .limit(1)
        .get();

      if (!existingActiveMembership.empty) {
        return res.status(409).json({
          error: "MEMBERSHIP_CONFLICT",
          message: "Er bestaat al een actieve membership voor deze gebruiker en klant",
        });
      }

      const now = new Date();
      const membershipRef = db.collection("memberships").doc();

      await membershipRef.set({
        authUid: req.user.uid,
        email: authEmail,
        displayName: body.displayName || req.user.name || invite.displayName || null,
        phoneNumber: invite.phoneNumber,
        phoneVerified: true,
        customerId: invite.customerId || null,
        role: invite.role || null,
        scope: invite.scope || {},
        active: true,
        invitedByAuthUid: invite.createdByAuthUid || null,
        inviteId: inviteDoc.id,
        createdAt: now,
        activatedAt: now,
      });

      await inviteDoc.ref.update({
        status: "accepted",
        acceptedAt: now,
        acceptedByAuthUid: req.user.uid,
      });

      return res.status(200).json({
        success: true,
        membershipId: membershipRef.id,
        inviteId: inviteDoc.id,
      });
    } catch (error) {
      console.error("POST /invites/accept error", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;




