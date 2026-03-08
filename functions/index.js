const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();
const messageBirdKey = defineSecret("MESSAGEBIRD_API_KEY");

// Hulpfunctie voor SMS versturen
async function sendSms(phone, templateId, boxId, customerName = "Klant") {
  const db = admin.firestore();
  const templateDoc = await db.collection('smsTemplates').doc(templateId).get();
  if (!templateDoc.exists) return;

  let message = templateDoc.data().body
    .replace("[boxId]", boxId)
    .replace("[Customer]", customerName);

  const postData = JSON.stringify({ 
    originator: "GridBox", 
    recipients: [phone], 
    body: message 
  });

  const options = {
    hostname: 'rest.messagebird.com',
    path: '/messages',
    method: 'POST',
    headers: {
      'Authorization': `AccessKey ${messageBirdKey.value()}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

exports.smsHandler = onRequest({ secrets: [messageBirdKey] }, async (req, res) => {
  const db = admin.firestore();
  
  // 1. Data Capture (Met het juiste pad voor de nieuwe API)
  const text = req.body?.payload?.lastMessage?.preview?.text || "";
  const sender = req.body?.payload?.lastMessage?.sender?.contact?.identifierValue || "";

  // 2. Logging
  await db.collection('smsIncoming').add({
    sender: sender,
    message: text,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    status: sender ? "received" : "error_no_sender"
  });

  // Regex voor OPEN 4
  const match = text.toUpperCase().match(/OPEN\s*(\d+)/);
  const boxId = match ? `gbox-00${match[1]}` : null;

  if (!boxId) {
    if (sender) await sendSms(sender, "unknown_command", "0", "Klant");
    return res.status(200).send("OK");
  }

  // 3. Autorisatie
  const authRef = db.collection('boxes').doc(boxId).collection('authorizedUsers');
  const userSnapshot = await authRef.where('phone', '==', sender).get();

  if (userSnapshot.empty) {
    console.log(`Toegang geweigerd: ${sender} voor ${boxId}`);
    if (sender) await sendSms(sender, "no_access", boxId.replace("gbox-00", ""), "Klant");
    return res.status(200).send("OK");
  }

  // 4. Commando Schrijven
  const customerName = userSnapshot.docs[0].data().name || "Klant";
  
  await db.collection('boxCommands').add({
    command: "OPEN",
    boxId: boxId,
    phone: sender,
    status: "pending",
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  if (sender) await sendSms(sender, "confirm_open", boxId.replace("gbox-00", ""), customerName);
  res.status(200).send("OK");
});