import prisma from "../../../config/database.js";
import { handleShowRooms } from "./richmenu.handler.js";
import {
  NO_PERIODS, GREETING, ROOM_NOT_SETUP, NOT_REGISTERED, NO_MEMBERSHIP,
  roomSummary, allRoomsSummary, MANUAL, UNKNOWN_COMMAND,
  BTN_CREATE_ROOM, BTN_PAY_CHECK, BTN_SUMMARY
} from "../../../constants/messages.js";

export async function handleShowPeriods(event, lineClient) {
  const userId = event.source.userId;
  const groupId = event.source.groupId;

  let room;
  if (groupId) {
    room = await prisma.room.findUnique({ where: { lineGroupId: groupId } });
  } else {
    const user = await prisma.user.findUnique({ where: { lineUid: userId } });
    if (!user) return;

    const membership = await prisma.roomMember.findFirst({
      where: { userId: user.id },
      include: { room: true }
    });
    room = membership?.room;
  }

  if (!room) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: NO_PERIODS }]
    });
  }

  const liffUrl = `https://liff.line.me/${process.env.LIFF_ID_PAY_BILL}?roomId=${room.id}`;

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: `จ่ายเงินค่าห้อง ${room.name}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: room.name, weight: 'bold', size: 'lg', wrap: true },
            { type: 'text', text: `กดปุ่มด้านล่างเพื่อจ่ายเงินค่าห้อง ${room.name}`, wrap: true, color: '#8c8c8c', size: 'sm' }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [{
            type: 'button',
            style: 'primary',
            color: '#ff334b',
            action: { type: 'uri', label: 'จ่ายเงิน', uri: liffUrl }
          }]
        }
      }
    }]
  });
}

export async function handleText(event, lineClient) {
  const text = event.message.text.trim();
  const replyToken = event.replyToken;
  const chatType = event.source.type;
  const isGroupChat = chatType === 'group';

  console.log('[handleText] received:', JSON.stringify(text), 'type:', chatType);

  // ===== 1. @mention (ใช้ได้ทั้ง group และ 1-on-1) =====
  if (text.match(/@[Ee][Zz][Cc]lass[Pp]ay/)) {
    const groupId = event.source.groupId;
    const liffUrl = groupId
      ? `https://liff.line.me/${process.env.LIFF_ID}?groupId=${groupId}`
      : `https://liff.line.me/${process.env.LIFF_ID}`;
    const botLineUrl = `https://line.me/R/ti/p/${process.env.LINE_BOT_ID || '@ไอดีบอท'}`;

    const quickReplyItems = [];

    if (groupId) {
      quickReplyItems.push({
        type: 'action',
        action: { type: 'uri', label: BTN_CREATE_ROOM, uri: liffUrl }
      });
    }

    quickReplyItems.push(
      {
        type: 'action',
        action: { type: 'uri', label: BTN_PAY_CHECK, uri: botLineUrl }
      },
      {
        type: 'action',
        action: { type: 'message', label: BTN_SUMMARY, text: 'ดูยอดรวม' }
      }
    );

    return lineClient.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: GREETING,
        quickReply: { items: quickReplyItems }
      }]
    });
  }

  // ===== 2. ดูยอดรวม (group → ดูยอดห้อง, 1-on-1 → ดูยอดรวมทุกห้อง) =====
  if (text === 'ดูยอดรวม') {
    if (isGroupChat) {
      const groupId = event.source.groupId;
      const room = await prisma.room.findUnique({
        where: { lineGroupId: groupId },
        include: {
          periods: {
            include: {
              payments: { where: { status: 'APPROVED' } }
            }
          }
        }
      });

      if (!room) {
        return lineClient.replyMessage({
          replyToken,
          messages: [{ type: 'text', text: ROOM_NOT_SETUP }]
        });
      }

      const totalTarget = room.totalTargetAmount || 0;
      const totalPaid = room.periods.reduce((sum, p) => sum + p.payments.length * p.amount, 0);

      return lineClient.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: roomSummary(room.name, totalPaid, totalTarget, room.periods.length)
        }]
      });
    }

    // 1-on-1: หาห้องที่ user เป็นสมาชิกอยู่
    const user = await prisma.user.findUnique({ where: { lineUid: event.source.userId } });
    if (!user) {
      return lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: NOT_REGISTERED }]
      });
    }

    const memberships = await prisma.roomMember.findMany({
      where: { userId: user.id },
      include: {
        room: {
          include: {
            periods: {
              include: {
                payments: { where: { status: 'APPROVED' } }
              }
            }
          }
        }
      }
    });

    if (memberships.length === 0) {
      return lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: NO_MEMBERSHIP }]
      });
    }

    const summaryText = memberships.map(m => {
      const r = m.room;
      const totalPaid = r.periods.reduce((sum, p) => sum + p.payments.length * p.amount, 0);
      return `• ${r.name}: เก็บได้ ${totalPaid} บาท`;
    }).join('\n');

    return lineClient.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: allRoomsSummary(summaryText)
      }]
    });
  }

  // ===== 3. คำสั่งอื่นๆ (ใช้ได้ทั้ง group และ 1-on-1) =====
  if (text === 'แสดงห้องทั้งหมด') {
    return handleShowRooms(event, lineClient);
  }

  if (text === 'คู่มือการใช้งาน') {
    return lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: MANUAL }]
    });
  }

  if (text === 'แจ้งโอนเงิน' || text === 'จ่ายเงิน') {
    return handleShowPeriods(event, lineClient);
  }

  // ===== 4. fallback สำหรับข้อความที่ไม่รู้จัก =====
  return lineClient.replyMessage({
    replyToken,
    messages: [{ type: 'text', text: UNKNOWN_COMMAND }]
  });
}
