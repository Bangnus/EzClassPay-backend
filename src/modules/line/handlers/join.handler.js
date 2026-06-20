import prisma from "../../../config/database.js";
import { GROUP_WELCOME } from "../../../constants/messages.js";

export async function handleBotJoin(event, lineClient) {
  const groupId = event.source.groupId;
  const botLineUrl = `https://line.me/R/ti/p/${process.env.LINE_BOT_ID || '@ไอดีบอท'}`;

  const room = await prisma.room.findUnique({
    where: { lineGroupId: groupId },
  });

  if (room) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `👋 ขอบคุณที่เชิญบอทเข้ากลุ่มครับ!\n\nห้อง "${room.name}" ตั้งค่าระบบเสร็จสมบูรณ์แล้ว \n\n⚠️ เพื่อให้บอทสามารถส่งใบแจ้งหนี้ให้ลูกบ้านทุกคนได้ โปรดให้สมาชิกทุกคนเพิ่มบอทเป็นเพื่อนด้วยนะครับ\n👉 แตะที่ลิงก์เพื่อเพิ่มเพื่อน: ${botLineUrl}`,
        },
      ],
    });
  }

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `${GROUP_WELCOME}\n\n⚠️ รบกวนสมาชิกในกลุ่มเพิ่มบอทเป็นเพื่อนด้วยนะครับ เพื่อให้รับการแจ้งเตือนค่าห้องได้\n👉 แตะที่ลิงก์เพื่อเพิ่มเพื่อน: ${botLineUrl}`,
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "uri",
                label: "➕ สร้างห้อง",
                uri: `https://liff.line.me/${process.env.LIFF_ID_CREATE_ROOM}?groupId=${groupId}`,
              },
            },
          ],
        },
      },
    ],
  });
}

export async function handleMemberJoined(event, lineClient) {
  const groupId = event.source.groupId;

  const room = await prisma.room.findUnique({
    where: { lineGroupId: groupId },
  });
  if (!room) return;

  const joinedUserIds = event.joined?.members
    ?.filter((m) => m.type === "user")
    .map((m) => m.userId)
    .filter(Boolean);

  if (!joinedUserIds?.length) return;

  const names = [];

  for (const lineUid of joinedUserIds) {
    try {
      const profile = await lineClient.getProfile(lineUid);
      const user = await prisma.user.upsert({
        where: { lineUid },
        update: { displayName: profile.displayName, pictureUrl: profile.pictureUrl },
        create: { lineUid, displayName: profile.displayName, pictureUrl: profile.pictureUrl },
      });

      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: room.id, userId: user.id } },
        update: {},
        create: { roomId: room.id, userId: user.id },
      });

      names.push(profile.displayName);
    } catch (e) {
      console.error(`[MemberJoined] Failed to process user ${lineUid}:`, e.message);
    }
  }

  if (names.length > 0) {
    const botLineUrl = `https://line.me/R/ti/p/${process.env.LINE_BOT_ID || '@ไอดีบอท'}`;
    await lineClient.pushMessage({
      to: groupId,
      messages: [
        {
          type: "text",
          text: `🎉 ยินดีต้อนรับ ${names.join(", ")} เข้าสู่ห้อง "${room.name}"!\n\nระบบได้เพิ่มคุณเข้าเป็นลูกบ้านเรียบร้อยแล้วครับ 📋\n\n⚠️ รบกวนเพิ่มบอทเป็นเพื่อนเพื่อรับการแจ้งเตือนยอดชำระด้วยนะครับ\n👉 แตะลิงก์เพื่อเพิ่มเพื่อน: ${botLineUrl}`,
        },
      ],
    });
  }
}
