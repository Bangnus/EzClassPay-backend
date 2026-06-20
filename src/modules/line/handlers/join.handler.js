import prisma from "../../../config/database.js";
import { GROUP_WELCOME } from "../../../constants/messages.js";

export async function handleBotJoin(event, lineClient) {
  const groupId = event.source.groupId;

  const room = await prisma.room.findUnique({
    where: { lineGroupId: groupId },
  });

  if (room) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `🙏 ขอบคุณที่เพิ่มบอท!\n\n📢 ห้อง "${room.name}" ถูกผูกกับกลุ่มนี้แล้ว\n\n💬 สมาชิกที่อยู่ในกลุ่มก่อนหน้านี้สามารถส่งข้อความใดๆ ในกลุ่มนี้เพื่อลงทะเบียนเป็นสมาชิกห้องโดยอัตโนมัติ`,
        },
      ],
    });
  }

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: GROUP_WELCOME,
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
    await lineClient.pushMessage({
      to: groupId,
      messages: [
        {
          type: "text",
          text: `👋 ยินดีต้อนรับ ${names.join(", ")} เข้าสู่ห้อง "${room.name}"!\n\nระบบได้เพิ่มคุณเป็นสมาชิกห้องเรียบร้อยแล้ว ✅`,
        },
      ],
    });
  }
}
