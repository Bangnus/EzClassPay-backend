import prisma from "../../../config/database.js";
import { handleShowRooms } from "./richmenu.handler.js";
import {
  NO_PERIODS, GREETING, ROOM_NOT_SETUP, NOT_REGISTERED, NO_MEMBERSHIP,
  roomSummary, allRoomsSummary, MANUAL, UNKNOWN_COMMAND,
  LABEL_PAYMENT_AMOUNT, LABEL_STATUS,
  STATUS_NOT_PAID, STATUS_PAID, STATUS_PENDING, STATUS_AWAITING_SLIP,
  BTN_CREATE_ROOM, BTN_PAY_CHECK, BTN_SUMMARY,
  BTN_PAY_PERIOD, ALT_PERIOD_LIST, displayPayingPeriod
} from "../../../constants/messages.js";

export async function handleShowPeriods(event, lineClient) {
  const userId = event.source.userId;
  const groupId = event.source.groupId;

  let room;
  if (groupId) {
    room = await prisma.room.findUnique({
      where: { lineGroupId: groupId },
      include: { periods: { orderBy: { createdAt: 'asc' } } }
    });
  } else {
    const user = await prisma.user.findUnique({ where: { lineUid: userId } });
    if (!user) return;

    const membership = await prisma.roomMember.findFirst({
      where: { userId: user.id },
      include: { room: { include: { periods: { orderBy: { createdAt: 'asc' } } } } }
    });
    room = membership?.room;
  }

  if (!room || room.periods.length === 0) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: NO_PERIODS }]
    });
  }

  const payments = await prisma.payment.findMany({
    where: {
      lineUid: userId,
      periodId: { in: room.periods.map(p => p.id) }
    },
    orderBy: { createdAt: 'desc' }
  });

  const paymentMap = {};
  for (const payment of payments) {
    if (!paymentMap[payment.periodId]) {
      paymentMap[payment.periodId] = payment;
    }
  }

  const MAX_BUBBLES = 10;
  const bubbles = room.periods.slice(0, MAX_BUBBLES).map(period => {
    const payment = paymentMap[period.id];
    let statusText, statusColor, badgeColor, showPayButton;

    if (!payment || payment.status === 'REJECTED') {
      statusText = STATUS_NOT_PAID;
      statusColor = '#ff334b';
      badgeColor = '#ff334b';
      showPayButton = true;
    } else if (payment.status === 'APPROVED') {
      statusText = STATUS_PAID;
      statusColor = '#00c300';
      badgeColor = '#00c300';
      showPayButton = false;
    } else if (payment.status === 'PENDING') {
      statusText = STATUS_PENDING;
      statusColor = '#ffb81c';
      badgeColor = '#ffb81c';
      showPayButton = false;
    } else {
      statusText = STATUS_AWAITING_SLIP;
      statusColor = '#ffb81c';
      badgeColor = '#ffb81c';
      showPayButton = false;
    }

    const bubble = {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '12px',
                height: '12px',
                backgroundColor: badgeColor,
                cornerRadius: '2px',
                alignSelf: 'center',
                flex: 0
              },
              {
                type: 'text',
                text: period.name,
                weight: 'bold',
                size: 'lg',
                wrap: true,
                flex: 1
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              { type: 'text', text: LABEL_PAYMENT_AMOUNT, color: '#8c8c8c', size: 'sm', flex: 1 },
              { type: 'text', text: `฿${period.amount}`, color: '#333333', size: 'sm', flex: 1, align: 'end', weight: 'bold' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              { type: 'text', text: LABEL_STATUS, color: '#8c8c8c', size: 'sm', flex: 1 },
              { type: 'text', text: statusText, color: statusColor, size: 'sm', flex: 1, align: 'end', weight: 'bold' }
            ]
          }
        ]
      }
    };

    if (showPayButton) {
      bubble.footer = {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#ff334b',
            height: 'sm',
            action: {
              type: 'postback',
              label: BTN_PAY_PERIOD,
              data: `action=pay&period_id=${period.id}`,
              displayText: displayPayingPeriod(period.name)
            }
          }
        ]
      };
    }

    return bubble;
  });

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: ALT_PERIOD_LIST,
      contents: { type: 'carousel', contents: bubbles }
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
