import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";

import lineWebhookRoutes from "./modules/line/line.route.js";

const app = express();

// 1. เส้นทาง Webhook สำหรับ LINE (ต้องอยู่ก่อน express.json)
app.use('/api/webhook', lineWebhookRoutes);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

export default app;
