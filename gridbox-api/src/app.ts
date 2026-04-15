import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health";
import meRoutes from "./routes/me";
import boxRoutes from "./routes/boxes";
import adminRoutes from "./routes/admin";
import invitesRoutes from "./routes/invites";
import deviceRoutes from "./routes/device";
import operationsRoutes from "./routes/operations";
import webhookRoutes from "./routes/webhooks";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);

  app.use(cors());
  app.use(express.json());

  app.use(healthRoutes);
  app.use(meRoutes);
  app.use(boxRoutes);
  app.use(adminRoutes);
  app.use(invitesRoutes);
  app.use(deviceRoutes);
  app.use(operationsRoutes);
  app.use(webhookRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      error: "NOT_FOUND",
      message: "Endpoint niet gevonden"
    });
  });

  return app;
}

