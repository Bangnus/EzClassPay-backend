import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";

import prisma from "./config/database.js";

import * as line from "@line/bot-sdk";

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

async function handleEvent(event) {
  if (event.type === 'message' && event.message.type === 'text') {
    const userMessage = event.message.text;
    const lineUid = event.source.userId;
    const replyToken = event.replyToken;

    try {
      // 1. ดึงข้อมูลโปรไฟล์ของ User จาก LINE
      const profile = await lineClient.getProfile(lineUid);
      
      // 2. บันทึกข้อมูลลง PostgreSQL (ตาราง users) ผ่าน Prisma ORM
      // ใช้ upsert เพื่อสร้างใหม่ถ้ายังไม่มี แต่ถ้ามีแล้วก็แค่อัปเดตชื่อ/รูปให้เป็นปัจจุบัน
      await prisma.user.upsert({
        where: { lineUid: profile.userId },
        update: {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl
        },
        create: {
          lineUid: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl
        }
      });

      console.log(`✅ บันทึกผู้ใช้: ${profile.displayName} ลง Database เรียบร้อยแล้ว`);

      // 3. ตอบกลับผู้ใช้งาน
      return lineClient.replyMessage({
        replyToken: replyToken,
        messages: [{ 
          type: 'text', 
          text: `สวัสดีคุณ ${profile.displayName}! ระบบได้ลงทะเบียนคุณเข้าสู่ EzClassPay เรียบร้อยแล้วครับ พิมพ์ "${userMessage}" มาใช่ไหมครับ?` 
        }]
      });

    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลหรือบันทึกลง DB:', error);
    }
  }
  return Promise.resolve(null);
}

// 1. เส้นทาง Webhook สำหรับ LINE (ต้องอยู่ก่อน express.json)
app.post('/api/webhook/line', line.middleware(lineConfig), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

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
