export const env = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || "development",
  gcpProjectId: process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || ""
};
