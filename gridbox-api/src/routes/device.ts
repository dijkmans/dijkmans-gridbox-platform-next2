import { createHash } from "crypto";
import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";

const router = Router();

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
      return res.status(409).json({
        error: "PROVISIONING_BOX_ID_MISMATCH",
        message: "boxId komt niet overeen met de provisioning"
      });
    }

    if (status !== "awaiting_first_boot") {
      return res.status(409).json({
        error: "BOOTSTRAP_CLAIM_NOT_ALLOWED",
        message: "Device claim is in deze provisioningstatus niet toegelaten"
      });
    }

    if (!bootstrapTokenHash || bootstrapTokenHash !== hashBootstrapToken(bootstrapToken)) {
      return res.status(403).json({
        error: "INVALID_BOOTSTRAP_TOKEN",
        message: "Bootstrap-token is ongeldig"
      });
    }

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

    await batch.commit();

    return res.json({
      ok: true,
      item: {
        provisioningId,
        boxId,
        customerId,
        siteId,
        status: "claimed",
        claimedAt
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
          state: {
            ...(boxDoc.data()?.state ?? {}),
            lastHeartbeatAt: heartbeatAt
          },
          software: {
            ...(boxDoc.data()?.software ?? {}),
            ...(softwareVersion
              ? { lastHeartbeatIso: heartbeatAt, currentVersion: softwareVersion }
              : { lastHeartbeatIso: heartbeatAt })
          },
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
          state: {
            ...(boxDoc.data()?.state ?? {}),
            lastHeartbeatAt: heartbeatAt
          },
          software: {
            ...(boxDoc.data()?.software ?? {}),
            ...(softwareVersion
              ? { lastHeartbeatIso: heartbeatAt, currentVersion: softwareVersion }
              : { lastHeartbeatIso: heartbeatAt })
          },
          updatedAt: heartbeatAt
        },
        { merge: true }
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
