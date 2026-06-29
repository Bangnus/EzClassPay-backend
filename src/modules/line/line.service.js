import * as line from "@line/bot-sdk";
import prisma from "../../config/database.js";

// นำเข้าตัวจัดการแยกแต่ละประเภท (Handlers)
import { handlePostback } from "./handlers/postback.handler.js";
import { handleImage } from "./handlers/image.handler.js";
import { handleText } from "./handlers/text.handler.js";
import { handleBotJoin, handleMemberJoined } from "./handlers/join.handler.js";
import { assignAllPastBillsToNewMember } from "../bills/bill.service.js";

export const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});
export const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

export async function handleEvent(event) {
  console.log("📥 มี Event เข้ามา:", JSON.stringify(event, null, 2));

  const userId = event.source.userId;
  const chatType = event.source.type;

  // 🟢 0. อัปเดตข้อมูลผู้ใช้ในระบบเสมอเมื่อทักมา
  if (userId) {
    try {
      const profile = await lineClient.getProfile(userId);
      const user = await prisma.user.upsert({
        where: { lineUid: userId },
        update: { displayName: profile.displayName, pictureUrl: profile.pictureUrl },
        create: { lineUid: userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl }
      });

      // ถ้ามาจากกลุ่ม — auto-add เป็น room member
      if (chatType === "group" && event.source.groupId) {
        const room = await prisma.room.findUnique({
          where: { lineGroupId: event.source.groupId },
        });
        if (room) {
          const existingMember = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId: room.id, userId: user.id } },
          });
          if (!existingMember) {
            await prisma.roomMember.create({
              data: { roomId: room.id, userId: user.id },
            });
            if (room.collectionType === "MONTHLY") {
              try {
                await assignAllPastBillsToNewMember(room.id);
              } catch (err) {
                console.error('Failed to assign past bills:', err.message);
              }
            }
          }
        }
      }
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
    return handleBotJoin(event, lineClient);
  }

  if (event.type === 'memberJoined' && chatType === 'group') {
    return handleMemberJoined(event, lineClient);
  }

  return Promise.resolve(null);
}
