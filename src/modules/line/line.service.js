import * as line from "@line/bot-sdk";
import prisma from "../../config/database.js";

// นำเข้าตัวจัดการแยกแต่ละประเภท (Handlers)
import { handlePostback } from "./handlers/postback.handler.js";
import { handleImage } from "./handlers/image.handler.js";
import { handleText } from "./handlers/text.handler.js";
import { handleJoin } from "./handlers/join.handler.js";

export const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});
export const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

export async function handleEvent(event) {
  const userId = event.source.userId;
  const chatType = event.source.type;

  // 🟢 0. อัปเดตข้อมูลผู้ใช้ในระบบเสมอเมื่อทักมา
  if (userId) {
    try {
      const profile = await lineClient.getProfile(userId);
      await prisma.user.upsert({
        where: { lineUid: userId },
        update: { displayName: profile.displayName, pictureUrl: profile.pictureUrl },
        create: { lineUid: userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl }
      });
    } catch (e) {
      console.error('Failed to upsert user profile:', e.message);
    }
  }

  // 🟢 กระจายงานไปยังไฟล์แยก (Routing)
  if (event.type === 'postback') {
    return handlePostback(event, lineClient);
  }
  
  if (event.type === 'message' && event.message.type === 'image') {
    return handleImage(event, lineClient, blobClient);
  }
  
  if (event.type === 'message' && event.message.type === 'text') {
    return handleText(event, lineClient);
  }
  
  if (event.type === 'join' && chatType === 'group') {
    return handleJoin(event, lineClient);
  }

  return Promise.resolve(null);
}
