import { Router } from "express";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { addBoxCommand } from "../repositories/commandRepository";
import { getBoxById } from "../repositories/boxRepository";
import { sendBirdSms } from "../services/birdSms";

const router = Router();

type SmsAction = "OPEN" | "CLOSE" | "UNKNOWN";

function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\s+/g, "");
  if (normalized.startsWith("0")) normalized = "+32" + normalized.substring(1);
  if (!normalized.startsWith("+")) normalized = "+" + normalized;
  return normalized;
}

function extractBoxIdFromText(text: string | null): string | null {
  if (!text) return null;

  const match = text.toUpperCase().match(/\b(?:GBOX[- ]?)?(\d{1,3})\b/);
  if (!match) return null;

  const nr = match[1].padStart(3, "0");
  return `gbox-${nr}`;
}

function extractBoxNumber(text: string | null): string | null {
  if (!text) return null;

  const match = text.toUpperCase().match(/\d+/);
  return match ? match[0] : null;
}

function detectAction(text: string | null): SmsAction {
  const msg = (text ?? "").toUpperCase();

  if (msg.includes("OPEN")) return "OPEN";
  if (msg.includes("CLOSE")) return "CLOSE";

  return "UNKNOWN";
}

async function resolveReplyText(
  templateName: string,
  boxNr: string,
  shortBoxNr: string,
  fallback: string
): Promise<string> {
  const templateSnap = await getFirestore().collection("smsTemplates").doc(templateName).get();
  const templateBody = templateSnap.data()?.body;

  if (typeof templateBody !== "string" || !templateBody.trim()) {
    return fallback;
  }

  return templateBody
    .replace(/\[boxId\]/g, boxNr)
    .replace(/\[boxNr\]/g, boxNr)
    .replace(/\[shortBoxNr\]/g, shortBoxNr);
}

router.post("/webhooks/bird/inbound", async (req, res) => {
  console.log("[Bird webhook] raw body:", JSON.stringify(req.body, null, 2));

  const body = req.body ?? {};
  const payload = body?.payload ?? body;

  const event = body?.event ?? null;
  const service = body?.service ?? null;

  const senderType =
    payload?.lastMessage?.sender?.type ??
    body?.sender?.type ??
    null;

  const phoneNumber =
    payload?.lastMessage?.sender?.contact?.identifierValue ??
    payload?.lastMessage?.sender?.contacts?.[0]?.identifierValue ??
    body?.sender?.contact?.identifierValue ??
    body?.sender?.contact?.platformAddress ??
    body?.sender?.contacts?.[0]?.identifierValue ??
    payload?.contact?.identifierValue ??
    payload?.participants?.find((p: any) => p.type === "contact")?.identifierValue ??
    payload?.participants?.[0]?.identifierValue ??
    null;

  const text =
    payload?.lastMessage?.preview?.text ??
    payload?.lastMessage?.body?.text?.text ??
    body?.body?.text?.text ??
    (typeof body?.body?.text === "string" ? body.body.text : null) ??
    (typeof body?.text === "string" ? body.text : null) ??
    (typeof payload?.text === "string" ? payload.text : null) ??
    null;

  const direction = body?.direction ?? payload?.direction ?? null;
  const conversationId = payload?.id ?? null;
  const messageId = payload?.lastMessage?.id ?? body?.id ?? null;
  const requestId = req.header("messagebird-request-id") ?? null;

  if (direction === "outbound") {
    console.log("[Bird webhook] outbound bericht genegeerd");
    return res.status(200).json({ ok: true, ignored: true, reason: "outbound-message" });
  }

  console.log("[Bird webhook] extracted:", {
    messageId,
    direction,
    extractedPhoneNumber: phoneNumber,
    extractedText: text,
  });

  if (senderType && senderType !== "contact") {
    return res.status(200).json({
      ok: true,
      ignored: true,
      reason: "non-contact-sender",
    });
  }

  const db = getFirestore();
  const docId = requestId || messageId || db.collection("smsLogs").doc().id;
  const smsLogRef = db.collection("smsLogs").doc(docId);

  try {
    const existingLog = await smsLogRef.get();

    if (existingLog.exists && existingLog.data()?.processingStatus === "handled") {
      return res.status(200).json({
        ok: true,
        duplicate: true,
      });
    }

    await smsLogRef.set(
      {
        richting: "inkomend",
        timestamp: FieldValue.serverTimestamp(),
        phoneNumber,
        text,
        boxId: extractBoxIdFromText(text),
        trigger: "bird-conversation-updated",
        service,
        event,
        conversationId,
        messageId,
        senderType,
        rawPayload: body,
      },
      { merge: true }
    );

    if (!text || !phoneNumber) {
      await smsLogRef.set(
        {
          processingStatus: "ignored",
          ignoreReason: "missing-text-or-phone",
        },
        { merge: true }
      );

      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "missing-text-or-phone",
      });
    }

    const boxNr = extractBoxNumber(text);

    if (!boxNr) {
      await smsLogRef.set(
        {
          processingStatus: "ignored",
          ignoreReason: "no-box-number",
        },
        { merge: true }
      );

      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "no-box-number",
      });
    }

    const shortBoxNr = parseInt(boxNr, 10).toString();
    const boxId = extractBoxIdFromText(text) ?? `gbox-${boxNr.padStart(3, "0")}`;
    const action = detectAction(text);

    const normalizedSenderPhone = normalizePhoneNumber(phoneNumber);
    const boxDoc = await getBoxById(boxId);

    if (!boxDoc) {
      const replyText = `Gridbox ${shortBoxNr} bestaat niet.`;

      await sendBirdSms(normalizedSenderPhone, replyText, {
        boxId,
        trigger: "sms-box-not-found",
      });

      await smsLogRef.set(
        {
          boxId,
          action,
          processingStatus: "box-not-found",
          replyText,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({
        ok: true,
        handled: true,
        status: "box-not-found",
      });
    }

    const shareRef = db.collection("boxes").doc(boxId).collection("shares").doc(normalizedSenderPhone);
    const shareDoc = await shareRef.get();
    const hasAccess = shareDoc.exists && shareDoc.data()?.active === true;

    if (!hasAccess) {
      const noAccessReply = `Je hebt geen toegang tot Gridbox ${shortBoxNr}.`;

      await sendBirdSms(normalizedSenderPhone, noAccessReply, {
        boxId,
        trigger: "sms-access-denied",
      });

      await smsLogRef.set(
        {
          boxId,
          action,
          processingStatus: "access-denied",
          replyText: noAccessReply,
        },
        { merge: true }
      );

      return res.status(200).json({
        ok: true,
        handled: true,
        status: "access-denied",
      });
    }

    let commandId: string | null = null;
    let templateName = "unknown_command";
    let replyText = `Actie geregistreerd voor Gridbox ${shortBoxNr}.`;

    if (action === "OPEN" || action === "CLOSE") {
      commandId = await addBoxCommand(
        boxId,
        action,
        `SMS van ${phoneNumber} ("${text}")`
      );

      templateName = action === "OPEN" ? "confirm_open" : "confirm_close";
      replyText = await resolveReplyText(
        templateName,
        boxNr,
        shortBoxNr,
        action === "OPEN"
          ? `Gridbox ${shortBoxNr} wordt geopend.`
          : `Gridbox ${shortBoxNr} wordt gesloten.`
      );
    } else {
      const unknownCommandRef = await db
        .collection("boxes")
        .doc(boxId)
        .collection("commands")
        .add({
          command: "UNKNOWN",
          status: "completed",
          source: `SMS van ${phoneNumber} ("${text}")`,
          createdAt: new Date().toISOString(),
        });

      commandId = unknownCommandRef.id;
      replyText = await resolveReplyText(
        templateName,
        boxNr,
        shortBoxNr,
        `Onbekende opdracht voor Gridbox ${shortBoxNr}.`
      );
    }

    await sendBirdSms(normalizedSenderPhone, replyText, {
      boxId,
      trigger: `sms-${action.toLowerCase()}`,
    });

    await smsLogRef.set(
      {
        boxId,
        action,
        commandId,
        templateName,
        replyText,
        processingStatus: "handled",
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      handled: true,
      action,
      boxId,
      commandId,
    });
  } catch (err) {
    console.error("[Bird webhook] inbound processing failed:", err);

    try {
      await smsLogRef.set(
        {
          processingStatus: "error",
          errorMessage: err instanceof Error ? err.message : "UNKNOWN_ERROR",
        },
        { merge: true }
      );
    } catch (logErr) {
      console.error("[Bird webhook] failed to persist error status:", logErr);
    }

    return res.status(500).json({ ok: false });
  }
});

export default router;