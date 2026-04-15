import { createHash } from "crypto";
import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env";

const router = Router();

async function tryLinkRmsDevice(boxId: string, gatewayMac: string): Promise<void> {
  try {
    const url = `${env.rmsApiBaseUrl}/devices`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.rmsApiToken}` }
    });
    if (!response.ok) {
      console.error(`tryLinkRmsDevice: RMS API fout ${response.status} voor ${boxId}`);
      return;
    }
    const data = await response.json() as { data?: Array<{ id: number; mac?: string }> };
    const devices = data.data ?? [];
    const normalize = (mac: string) => mac.toLowerCase().replace(/[-:]/g, "");
    const normalizedTarget = normalize(gatewayMac);
    const match = devices.find((d) => d.mac && normalize(d.mac) === normalizedTarget);
    if (!match) {
      console.log(`tryLinkRmsDevice: geen RMS device gevonden voor MAC ${gatewayMac} (${boxId})`);
      return;
    }
    const db = getFirestore();
    await db.collection("boxes").doc(boxId).set(
      { hardware: { rmsDeviceId: match.id } },
      { merge: true }
    );
    console.log(`tryLinkRmsDevice: rmsDeviceId ${match.id} gekoppeld aan ${boxId}`);
  } catch (err) {
    console.error(`tryLinkRmsDevice: fout bij koppelen voor ${boxId}:`, err);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function hashBootstrapToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

router.post("/device/bootstrap/claim", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const provisioningId =
      typeof body.provisioningId === "string" ? body.provisioningId.trim() : "";
    const rawBoxId =
      typeof body.boxId === "string" ? body.boxId.trim() : "";
    const boxId = rawBoxId.toLowerCase();
    const bootstrapToken =
      typeof body.bootstrapToken === "string" ? body.bootstrapToken.trim() : "";
    const deviceName =
      typeof body.deviceName === "string" && body.deviceName.trim()
        ? body.deviceName.trim()
        : rawBoxId;

    if (!provisioningId) {
      return res.status(400).json({
        error: "INVALID_PROVISIONING_ID",
        message: "Provisioning id is verplicht"
      });
    }

    if (!rawBoxId) {
      return res.status(400).json({
        error: "INVALID_BOX_ID",
        message: "boxId is verplicht"
      });
    }

    if (!bootstrapToken) {
      return res.status(400).json({
        error: "INVALID_BOOTSTRAP_TOKEN",
        message: "bootstrapToken is verplicht"
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
    const expectedBoxId =
      typeof provisioningData.boxId === "string"
        ? provisioningData.boxId.trim().toLowerCase()
        : "";
    const customerId =
      typeof provisioningData.customerId === "string"
        ? provisioningData.customerId.trim()
        : "";
    const siteId =
      typeof provisioningData.siteId === "string"
        ? provisioningData.siteId.trim()
        : "";
    const status =
      typeof provisioningData.status === "string"
        ? provisioningData.status
        : "";
    const bootstrapTokenHash =
      typeof provisioningData.bootstrapTokenHash === "string"
        ? provisioningData.bootstrapTokenHash.trim()
        : "";

    if (!expectedBoxId || !customerId || !siteId) {
      return res.status(400).json({
        error: "PROVISIONING_INCOMPLETE",
        message: "Provisioning mist verplichte basisgegevens"
      });
    }

    if (expectedBoxId !== boxId) {
      try {
        await provisioningRef.set({ lastError: "PROVISIONING_BOX_ID_MISMATCH", updatedAt: nowIso() }, { merge: true });
      } catch (writeError) {
        console.error("FOUT bij schrijven lastError voor PROVISIONING_BOX_ID_MISMATCH", writeError);
      }
      return res.status(409).json({
        error: "PROVISIONING_BOX_ID_MISMATCH",
        message: "boxId komt niet overeen met de provisioning"
      });
    }

    const claimableStatuses = ["awaiting_first_boot", "awaiting_sd_preparation", "draft"];
    if (!claimableStatuses.includes(status)) {
      return res.status(409).json({
        error: "BOOTSTRAP_CLAIM_NOT_ALLOWED",
        message: "Device claim is in deze provisioningstatus niet toegelaten"
      });
    }

    if (!bootstrapTokenHash || bootstrapTokenHash !== hashBootstrapToken(bootstrapToken)) {
      try {
        await provisioningRef.set({ lastError: "INVALID_BOOTSTRAP_TOKEN", updatedAt: nowIso() }, { merge: true });
      } catch (writeError) {
        console.error("FOUT bij schrijven lastError voor INVALID_BOOTSTRAP_TOKEN", writeError);
      }
      return res.status(403).json({
        error: "INVALID_BOOTSTRAP_TOKEN",
        message: "Bootstrap-token is ongeldig"
      });
    }

        const host = req.get("host");

    if (!host) {
      return res.status(500).json({
        error: "API_BASE_URL_UNAVAILABLE",
        message: "Kon geen geldige apiBaseUrl bepalen"
      });
    }

    const apiBaseUrl = `${req.protocol}://${host}`;
    const claimedAt = nowIso();

    const boxRef = db.collection("boxes").doc(boxId);
    const batch = db.batch();

    batch.set(
      provisioningRef,
      {
        status: "claimed",
        claimedAt,
        claimedByDevice: deviceName || rawBoxId,
        bootstrapTokenHash: "",
        lastError: "",
        updatedAt: claimedAt
      },
      { merge: true }
    );

    batch.set(
      boxRef,
      {
        boxId,
        customerId,
        siteId,
        updatedAt: claimedAt
      },
      { merge: true }
    );

    const customerBoxAccessRef = db
      .collection("customerBoxAccess")
      .doc(`${customerId}__${boxId}`);

    batch.set(
      customerBoxAccessRef,
      {
        active: true,
        boxId,
        customerId,
        addedBy: "system",
        updatedAt: claimedAt
      },
      { merge: true }
    );

    await batch.commit();

        return res.json({
      ok: true,
      item: {
        provisioningId,
        boxId,
        customerId,
        siteId,
        status: "claimed",
        claimedAt,
        apiBaseUrl,
        runtimeConfig: {
          boxId,
          customerId,
          siteId,
          apiBaseUrl
        }
      }
    });
  } catch (error) {
    console.error("FOUT in POST /device/bootstrap/claim", error);

    return res.status(500).json({
      error: "DEVICE_BOOTSTRAP_CLAIM_FAILED",
      message: "Kon device bootstrap claim niet verwerken"
    });
  }
});


router.post("/device/heartbeat", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const rawBoxId =
      typeof body.boxId === "string" ? body.boxId.trim() : "";
    const boxId = rawBoxId.toLowerCase();
    const provisioningId =
      typeof body.provisioningId === "string" ? body.provisioningId.trim() : "";
    const deviceName =
      typeof body.deviceName === "string" && body.deviceName.trim()
        ? body.deviceName.trim()
        : rawBoxId;
    const softwareVersion =
      typeof body.softwareVersion === "string" && body.softwareVersion.trim()
        ? body.softwareVersion.trim()
        : "";
    const softwarePayload =
      typeof body.software === "object" && body.software !== null && !Array.isArray(body.software)
        ? body.software as Record<string, unknown>
        : undefined;

    if (!rawBoxId) {
      return res.status(400).json({
        error: "INVALID_BOX_ID",
        message: "boxId is verplicht"
      });
    }

    const db = getFirestore();
    const heartbeatAt = nowIso();
    const boxRef = db.collection("boxes").doc(boxId);
    const boxDoc = await boxRef.get();

    if (!boxDoc.exists) {
      return res.status(404).json({
        error: "BOX_NOT_FOUND",
        message: "Box bestaat niet"
      });
    }

    let provisioningStatus: string | undefined;

    if (provisioningId) {
      const provisioningRef = db.collection("provisionings").doc(provisioningId);
      const provisioningDoc = await provisioningRef.get();

      if (!provisioningDoc.exists) {
        return res.status(404).json({
          error: "PROVISIONING_NOT_FOUND",
          message: "Provisioning bestaat niet"
        });
      }

      const provisioningData = provisioningDoc.data() ?? {};
      const expectedBoxId =
        typeof provisioningData.boxId === "string"
          ? provisioningData.boxId.trim().toLowerCase()
          : "";
      const currentStatus =
        typeof provisioningData.status === "string"
          ? provisioningData.status
          : "";

      if (expectedBoxId !== boxId) {
        return res.status(409).json({
          error: "PROVISIONING_BOX_ID_MISMATCH",
          message: "boxId komt niet overeen met de provisioning"
        });
      }

      provisioningStatus =
        currentStatus === "claimed"
          ? "online"
          : currentStatus === "online" || currentStatus === "ready"
            ? currentStatus
            : currentStatus;

      const batch = db.batch();

      batch.set(
        boxRef,
        {
          status: "online",
          state: {
            ...(boxDoc.data()?.state ?? {}),
            lastHeartbeatAt: heartbeatAt
          },
          software: {
            ...(boxDoc.data()?.software ?? {}),
            ...(softwarePayload ?? {}),
            ...(softwareVersion
              ? { currentVersion: softwareVersion, versionRaspberry: softwareVersion }
              : {}),
            lastHeartbeatIso: heartbeatAt
          },
          ...(typeof body.gatewayMac === "string" && body.gatewayMac.trim()
            ? { gatewayMac: body.gatewayMac.trim() }
            : {}),
          updatedAt: heartbeatAt
        },
        { merge: true }
      );

      batch.set(
        provisioningRef,
        {
          lastHeartbeatAt: heartbeatAt,
          ...(provisioningStatus ? { status: provisioningStatus } : {}),
          updatedAt: heartbeatAt,
          ...(deviceName ? { claimedByDevice: deviceName } : {})
        },
        { merge: true }
      );

      await batch.commit();
    } else {
      await boxRef.set(
        {
          status: "online",
          state: {
            ...(boxDoc.data()?.state ?? {}),
            lastHeartbeatAt: heartbeatAt
          },
          software: {
            ...(boxDoc.data()?.software ?? {}),
            ...(softwarePayload ?? {}),
            ...(softwareVersion
              ? { currentVersion: softwareVersion, versionRaspberry: softwareVersion }
              : {}),
            lastHeartbeatIso: heartbeatAt
          },
          ...(typeof body.gatewayMac === "string" && body.gatewayMac.trim()
            ? { gatewayMac: body.gatewayMac.trim() }
            : {}),
          updatedAt: heartbeatAt
        },
        { merge: true }
      );
    }

    const existingRmsDeviceId = (boxDoc.data()?.hardware as Record<string, unknown> | undefined)?.rmsDeviceId;
    const gatewayMac =
      typeof body.gatewayMac === "string" && body.gatewayMac.trim()
        ? body.gatewayMac.trim()
        : typeof softwarePayload?.gatewayMac === "string" && softwarePayload.gatewayMac.trim()
        ? softwarePayload.gatewayMac.trim()
        : "";
    const existingGatewayMac = boxDoc.data()?.gatewayMac as string | undefined;
    const macChanged = gatewayMac && existingGatewayMac && gatewayMac !== existingGatewayMac;
    const noRmsLink = !existingRmsDeviceId;

    if (gatewayMac && (noRmsLink || macChanged)) {
      tryLinkRmsDevice(boxId, gatewayMac).catch((err) =>
        console.error("tryLinkRmsDevice fire-and-forget fout:", err)
      );
    }

    return res.json({
      ok: true,
      item: {
        boxId,
        heartbeatAt,
        ...(provisioningId ? { provisioningId } : {}),
        ...(provisioningStatus ? { provisioningStatus } : {})
      }
    });
  } catch (error) {
    console.error("FOUT in POST /device/heartbeat", error);

    return res.status(500).json({
      error: "DEVICE_HEARTBEAT_FAILED",
      message: "Kon device heartbeat niet verwerken"
    });
  }
});

export default router;
