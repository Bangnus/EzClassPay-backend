import prisma from "../../../config/database.js";
import { RICH_MENU } from "../../../constants/richmenu.js";

export async function handleSwitchRoom(event, lineClient) {
  const userId = event.source.userId;
  await lineClient.linkRichMenu(userId, RICH_MENU.SELECT);

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: 'กลับสู่หน้าหลักเรียบร้อยครับ เลือกห้องที่ต้องการจัดการได้เลย 👆'
    }]
  });
}

export async function handleSelectRoom(event, lineClient) {
  const userId = event.source.userId;
  const data = new URLSearchParams(event.postback.data);
  const roomId = data.get('room_id');

  const room = await prisma.room.findUnique({
    where: { id: roomId }
  });

  if (!room) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'ไม่พบข้อมูลห้องนี้ครับ' }]
    });
  }

  const user = await prisma.user.findUnique({ where: { lineUid: userId } });
  if (!user) return;

  const isManager = room.managerId === user.id;

  if (isManager) {
    await lineClient.linkRichMenu(userId, RICH_MENU.MANAGER);
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: `ยินดีต้อนรับ Manager ห้อง "${room.name}" ครับ 👑`
      }]
    });
  }

  await lineClient.linkRichMenu(userId, RICH_MENU.MEMBER);
  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: `คุณกำลังจัดการห้อง "${room.name}" ในฐานะสมาชิกครับ 😊`
    }]
  });
}

export async function handleShowRooms(event, lineClient) {
  const userId = event.source.userId;

  const user = await prisma.user.findUnique({
    where: { lineUid: userId },
    include: {
      ownedRooms: true,
      joinedRooms: { include: { room: true } }
    }
  });

  if (!user) return;

  const allRooms = [
    ...user.ownedRooms,
    ...user.joinedRooms.map(jr => jr.room)
  ];

  const uniqueRooms = allRooms.filter((r, i, arr) =>
    arr.findIndex(x => x.id === r.id) === i
  );

  if (uniqueRooms.length === 0) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: 'คุณยังไม่มีห้องที่เข้าร่วมอยู่ครับ กรุณาให้ผู้ดูแลเพิ่มคุณในห้อง หรือสร้างห้องผ่าน LIFF 👇'
      }]
    });
  }

  const bubbles = uniqueRooms.map(room => ({
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: room.name,
          weight: 'bold',
          size: 'lg',
          wrap: true
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            { type: 'text', text: 'เลขพร้อมเพย์', color: '#8c8c8c', size: 'sm', flex: 1 },
            { type: 'text', text: room.promptpayNo, color: '#333333', size: 'sm', flex: 1, align: 'end' }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [{
        type: 'button',
        style: 'primary',
        height: 'sm',
        action: {
          type: 'postback',
          label: 'เลือกห้องนี้',
          data: `action=select_room&room_id=${room.id}`,
          displayText: `กำลังเลือกห้อง ${room.name}`
        }
      }]
    }
  }));

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: 'รายการห้องทั้งหมด',
      contents: { type: 'carousel', contents: bubbles }
    }]
  });
}
