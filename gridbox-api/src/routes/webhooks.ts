import { Router } from "express";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const router = Router();

router.post("/webhooks/bird/inbound", async (req, res) => {
  console.log("[Bird webhook] raw body:", JSON.stringify(req.body, null, 2));

  const phoneNumber =
    req.body?.receiver?.contacts?.[0]?.identifierValue ||
    req.body?.sender?.contacts?.[0]?.identifierValue ||
    null;

  const text = req.body?.body?.text?.text || null;

  try {
    const db = getFirestore();
    await db.collection("smsLogs").add({
      phoneNumber,
      text,
      richting: "inkomend",
      timestamp: FieldValue.serverTimestamp(),
      boxId: null,
      trigger: "webhook-inkomend",
      rawPayload: req.body,
    });
  } catch (err) {
    console.error("[Bird webhook] Firestore write failed:", err);
  }

  return res.status(200).json({ ok: true });
});

export default router;
