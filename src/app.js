import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import { startBillingCron } from "./cron/billing.cron.js";
import { startSubscriptionCron } from "./cron/subscription.cron.js";
import { logger } from "./utils/logger.js";

import lineWebhookRoutes from "./modules/line/line.route.js";
import stripeWebhookRoutes from "./modules/subscriptions/stripe.webhook.js";

const app = express();

// 1. Webhook routes (ต้องอยู่ก่อน express.json — ต้องการ raw body)
app.use("/api/webhook", express.text({ type: "*/*", limit: "5mb" }), lineWebhookRoutes);
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookRoutes);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/files/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const minioUrl = `http://host.docker.internal:9000/ezclasspay-bucket/${filename}`;
    const response = await fetch(minioUrl);
    if (!response.ok) return res.status(404).json({ error: "File not found" });
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    res.set("Content-Type", mimeMap[ext] || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

// Start cron jobs
try {
  startBillingCron();
  startSubscriptionCron();
} catch (err) {
  logger.error(`Failed to start cron jobs: ${err.message}`);
}

app.use(notFound);
app.use(errorHandler);

export default app;
