import { env } from "../config/env";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function requireBirdConfig() {
  if (!env.birdApiKey || !env.birdWorkspaceId || !env.birdChannelId) {
    throw new Error("BIRD_CONFIG_MISSING");
  }
}

async function upsertBirdConversation(phoneNumber: string): Promise<void> {
  const searchUrl = `https://api.bird.com/workspaces/${env.birdWorkspaceId}/conversations?identifierKey=phonenumber&identifierValue=${encodeURIComponent(phoneNumber)}&channelId=${env.birdChannelId}`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `AccessKey ${env.birdApiKey}`,
      Accept: "application/json",
    },
  });

  if (searchRes.ok) {
    const data = (await searchRes.json()) as { results?: unknown[] };
    if (data.results && data.results.length > 0) return;
  }

  const createRes = await fetch(
    `https://api.bird.com/workspaces/${env.birdWorkspaceId}/conversations`,
    {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${env.birdApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        channelId: env.birdChannelId,
        contact: { identifierKey: "phonenumber", identifierValue: phoneNumber },
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    console.warn(`[BIRD] upsertConversation failed for ${phoneNumber}: ${err}`);
  }
}

export async function sendBirdSms(
  phoneNumber: string,
  text: string,
  logContext?: { boxId?: string; trigger?: string }
): Promise<void> {
  requireBirdConfig();

  const payload = {
    receiver: {
      contacts: [
        {
          identifierValue: phoneNumber,
        },
      ],
    },
    body: {
      type: "text",
      text: {
        text,
      },
    },
  };

  const response = await fetch(
    `https://api.bird.com/workspaces/${env.birdWorkspaceId}/channels/${env.birdChannelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${env.birdApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BIRD_SMS_FAILED: ${errorText}`);
  }

  const db = getFirestore();
  await db.collection("smsLogs").add({
    phoneNumber,
    text,
    richting: "uitgaand",
    timestamp: FieldValue.serverTimestamp(),
    boxId: logContext?.boxId ?? null,
    trigger: logContext?.trigger ?? "onbekend",
  });

  await upsertBirdConversation(phoneNumber).catch((err: Error) => {
    console.warn("[BIRD] upsertConversation error:", err.message);
  });
}
