import { env } from "../config/env";

function requireBirdConfig() {
  if (!env.birdApiKey || !env.birdWorkspaceId || !env.birdChannelId) {
    throw new Error("BIRD_CONFIG_MISSING");
  }
}

export async function sendBirdSms(phoneNumber: string, text: string): Promise<void> {
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
}
