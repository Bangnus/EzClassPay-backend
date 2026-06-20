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

    if (user.activeRoomId) {
      room = await prisma.room.findUnique({ where: { id: user.activeRoomId } });
    }
    if (!room) {
      const membership = await prisma.roomMember.findFirst({
        where: { userId: user.id },
        include: { room: true }
      });
      room = membership?.room;
    }
  }

  if (!room) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: NO_PERIODS }]
    });
  }

  const periods = await prisma.period.findMany({
    where: { roomId: room.id },
    include: {
      payments: {
        where: { lineUid: event.source.userId }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  if (periods.length === 0) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: "ยังไม่มีงวดชำระเงินในห้องนี้ครับ" }]
    });
  }

  const bubbles = periods.map(period => {
    const payment = period.payments[0];
    const isPaid = payment && payment.status === 'APPROVED';
    const isPending = payment && payment.status === 'AWAITING_SLIP';
    
    let buttonStyle = 'primary';
    let buttonColor = '#00c6ae';
    let buttonLabel = '💳 เลือกชำระงวดนี้';
    let action = { type: 'postback', label: buttonLabel, data: `action=pay&period_id=${period.id}` };

    if (isPaid) {
      buttonColor = '#16a34a'; // green
      buttonLabel = '✅ ชำระแล้ว';
      action = { type: 'uri', label: buttonLabel, uri: 'https://line.me/R/' }; // dummy action
    } else if (isPending) {
      buttonColor = '#f59e0b'; // amber
      buttonLabel = '⏳ รอตรวจสอบ';
      action = { type: 'postback', label: buttonLabel, data: `action=pay&period_id=${period.id}` };
    }

    return {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#00c6ae',
        paddingTop: '12px',
        paddingBottom: '12px',
        contents: [
          {
            type: 'text',
            text: `💸 ชำระเงินค่าห้อง`,
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
            align: 'center'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: room.name,
            weight: 'bold',
            size: 'lg',
            color: '#16a085',
            wrap: true,
            align: 'center'
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#e5e7eb'
          },
          {
            type: 'text',
            text: period.name,
            weight: 'bold',
            size: 'md',
            color: '#374151',
            wrap: true,
            align: 'center',
            margin: 'md'
          },
          {
            type: 'text',
            text: `ยอดเงิน: ฿${Number(period.amount).toLocaleString()}`,
            size: 'sm',
            color: '#6b7280',
            align: 'center',
            margin: 'sm'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: [{
          type: 'button',
          style: buttonStyle,
          color: buttonColor,
          height: 'sm',
          action: action
        }]
      }
    };
  });

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: `เลือกงวดชำระเงินค่าห้อง ${room.name}`,
      contents: {
        type: 'carousel',
        contents: bubbles
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
      ? `https://liff.line.me/${process.env.LIFF_ID_CREATE_ROOM}?groupId=${groupId}`
      : `https://liff.line.me/${process.env.LIFF_ID_CREATE_ROOM}`;
    const botLineUrl = `https://line.me/R/ti/p/${process.env.LINE_BOT_ID || '@ไอดีบอท'}`;

    const quickReplyItems = [];

    if (groupId) {
      quickReplyItems.push(
        {
          type: 'action',
          action: { type: 'uri', label: BTN_CREATE_ROOM, uri: liffUrl }
        },
        {
          type: 'action',
          action: { type: 'postback', label: BTN_PAY_CHECK, data: `action=group_pay_check&group_id=${groupId}` }
        }
      );
    } else {
      quickReplyItems.push({
        type: 'action',
        action: { type: 'postback', label: BTN_PAY_CHECK, data: `action=pay` }
      });
    }

    quickReplyItems.push(
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
          },
          bills: true
        }
      });

      if (!room) {
        return lineClient.replyMessage({
          replyToken,
          messages: [{ type: 'text', text: ROOM_NOT_SETUP }]
        });
      }

      const totalTarget = room.totalTargetAmount || 0;
      let totalPaid = 0;
      let periodCount = 0;

      if (room.collectionType === 'MONTHLY') {
        totalPaid = room.bills.filter(b => b.status === 'PAID').reduce((sum, b) => sum + b.amount, 0);
        periodCount = new Set(room.bills.map(b => `${b.month}-${b.year}`)).size;
      } else {
        totalPaid = room.periods.reduce((sum, p) => sum + p.payments.length * p.amount, 0);
        periodCount = room.periods.length;
      }

      return lineClient.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: roomSummary(room.name, totalPaid, totalTarget, periodCount)
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
            },
            bills: true
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
      let totalPaid = 0;
      if (r.collectionType === 'MONTHLY') {
        totalPaid = r.bills.filter(b => b.status === 'PAID').reduce((sum, b) => sum + b.amount, 0);
      } else {
        totalPaid = r.periods.reduce((sum, p) => sum + p.payments.length * p.amount, 0);
      }
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
    console.log('[RICH_MENU_TEXT] แสดงห้องทั้งหมด', {
      userId: event.source.userId,
      groupId: event.source.groupId,
    });
    return handleShowRooms(event, lineClient);
  }

  if (text === 'คู่มือการใช้งาน') {
    console.log('[RICH_MENU_TEXT] คู่มือการใช้งาน', {
      userId: event.source.userId,
      groupId: event.source.groupId,
    });
    return lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: MANUAL }]
    });
  }

  if (text === 'แจ้งโอนเงิน' || text === 'จ่ายเงิน') {
    return handleShowPeriods(event, lineClient);
  }

  // ===== 4. fallback สำหรับข้อความที่ไม่รู้จัก =====
  // return lineClient.replyMessage({
  //   replyToken,
  //   messages: [{ type: 'text', text: UNKNOWN_COMMAND }]
  // });
}
