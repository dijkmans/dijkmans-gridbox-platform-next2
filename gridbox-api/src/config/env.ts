export const env = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || "development",
  gcpProjectId: process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "",

  birdApiKey: process.env.BIRD_API_KEY || "",
  birdWorkspaceId: process.env.BIRD_WORKSPACE_ID || "",
  birdChannelId: process.env.BIRD_CHANNEL_ID || "",
  birdSmsFrom: process.env.BIRD_SMS_FROM || "",

  rmsApiToken: process.env.RMS_API_TOKEN || "",
  rmsApiBaseUrl: "https://rms.teltonika-networks.com/api",
  githubToken: process.env.GITHUB_TOKEN || "",
  apiBaseUrl: process.env.API_BASE_URL || "",
};
