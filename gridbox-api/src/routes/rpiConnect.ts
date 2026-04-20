import { Router } from "express";
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

  if (
    (!membership || membership.role !== "platformAdmin") &&
    portalUser.email !== "piet.dijkmans@gmail.com"
  ) {
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

// GET /admin/rpi-connect/health
// Geeft terug of RPI_CONNECT_TOKEN aanwezig is.
router.get("/admin/rpi-connect/health", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);
    return res.json({ tokenPresent: Boolean(env.rpiConnectToken) });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in GET /admin/rpi-connect/health", error);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Interne fout" });
  }
});

// POST /admin/rpi-connect/auth-key
// Vraagt een tijdelijke auth key aan bij de Pi Connect API.
router.post("/admin/rpi-connect/auth-key", async (req, res) => {
  try {
    await requirePlatformAdmin(req.header("Authorization") || undefined);

    const deviceName =
      typeof req.body?.deviceName === "string" ? req.body.deviceName.trim() : "";

    if (!deviceName) {
      return res.status(400).json({
        error: "MISSING_DEVICE_NAME",
        message: "deviceName is verplicht"
      });
    }

    if (!env.rpiConnectToken) {
      return res.json({ secret: null, reason: "no_token" });
    }

    const formBody = `description=${encodeURIComponent(deviceName)}&ttl_days=7`;

    let apiRes: Response;
    try {
      apiRes = await fetch(`${env.rpiConnectApiBaseUrl}/organisation/auth-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.rpiConnectToken}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formBody
      });
    } catch (fetchErr) {
      console.warn("rpi-connect/auth-key: fetch fout:", fetchErr);
      return res.json({ secret: null, reason: "api_error" });
    }

    if (!apiRes.ok) {
      console.warn(`rpi-connect/auth-key: API HTTP ${apiRes.status} voor ${deviceName}`);
      return res.json({ secret: null, reason: "api_error" });
    }

    const data = await apiRes.json() as { secret?: string };
    const secret = typeof data.secret === "string" && data.secret ? data.secret : null;

    return res.json({ secret, ...(secret ? {} : { reason: "api_error" }) });
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 401) return res.status(401).json({ error: "UNAUTHORIZED", message: "Niet aangemeld" });
    if (statusCode === 403) return res.status(403).json({ error: "FORBIDDEN", message: "Geen admin-toegang" });
    console.error("FOUT in POST /admin/rpi-connect/auth-key", error);
    return res.json({ secret: null, reason: "api_error" });
  }
});

export default router;
