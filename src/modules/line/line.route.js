import { Router } from "express";
import * as line from "@line/bot-sdk";
import * as lineController from "./line.controller.js";

const router = Router();

const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// เส้นทาง Webhook สำหรับ LINE (ต้องอยู่ก่อน express.json)
// Mount path จะเป็น /api/webhook/line
router.post("/line", line.middleware(lineConfig), lineController.webhook);

export default router;
