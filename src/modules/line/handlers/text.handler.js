import prisma from "../../../config/database.js";
import { handleShowRooms } from "./richmenu.handler.js";
import {
  NO_PERIODS, GREETING, ROOM_NOT_SETUP, NOT_REGISTERED, NO_MEMBERSHIP,
  roomSummary, allRoomsSummary, MANUAL, UNKNOWN_COMMAND,
  BTN_CREATE_ROOM, BTN_PAY_CHECK, BTN_SUMMARY
} from "../../../constants/messages.js";

export async function buildPaymentItemsMessage(room, userId, prisma) {
  let items = [];

  if (room.collectionType === 'MONTHLY') {
    const user = await prisma.user.findUnique({ where: { lineUid: userId } });
    if (!user) return null;

    const bills = await prisma.bill.findMany({
      where: { roomId: room.id, userId: user.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 10
    });

    const pendingPayments = await prisma.payment.findMany({
      where: { roomId: room.id, lineUid: userId, status: { in: ['AWAITING_SLIP', 'PENDING'] } },
      select: { billId: true, status: true }
    });
    const paymentByBillId = {};
    for (const p of pendingPayments) {
      if (p.billId) paymentByBillId[p.billId] = p.status;
    }

    items = bills.map(b => ({
      id: b.id,
      type: 'bill',
      name: `บิลเดือน ${b.month}/${b.year}`,
      amount: b.amount,
      isPaid: b.status === 'PAID',
      paymentStatus: b.status === 'UNPAID' ? (paymentByBillId[b.id] || null) : null
    }));
  } else {
    const user = await prisma.user.findUnique({ where: { lineUid: userId } });
    if (!user) return null;

    const approvedPayment = await prisma.payment.findFirst({
      where: { roomId: room.id, lineUid: userId, status: 'APPROVED' }
    });

    const pendingPayment = await prisma.payment.findFirst({
      where: { roomId: room.id, lineUid: userId, status: { in: ['AWAITING_SLIP', 'PENDING'] } }
    });

    items = [{
      id: room.id,
      type: 'target',
      name: 'เป้าหมายรวม',
      amount: room.totalTargetAmount || 0,
      isPaid: !!approvedPayment,
      paymentStatus: pendingPayment ? pendingPayment.status : null
    }];
  }

  if (items.length === 0) {
    return { type: 'text', text: "ยังไม่มีงวดชำระเงินในห้องนี้ครับ" };
  }

  const bubbles = items.map(item => {
    let buttonStyle = 'primary';
    let buttonColor = '#00c6ae';
    let buttonLabel = '💳 เลือกชำระงวดนี้';
    
    const liffPayUrl = item.type === 'target'
      ? `https://liff.line.me/${process.env.LIFF_ID_PAY_BILL || ''}?roomId=${room.id}&type=target`
      : `https://liff.line.me/${process.env.LIFF_ID_PAY_BILL || ''}?roomId=${room.id}&${item.type}Id=${item.id}`;
    let action = { type: 'uri', label: buttonLabel, uri: liffPayUrl };

    if (item.isPaid) {
      buttonColor = '#16a34a';
      buttonLabel = '✅ ชำระแล้ว';
      action = { type: 'uri', label: buttonLabel, uri: 'https://line.me/R/' };
    } else if (item.paymentStatus === 'PENDING') {
      buttonColor = '#ea580c';
      buttonLabel = '⏳ รอตรวจสอบสลิป';
      action = { type: 'uri', label: buttonLabel, uri: liffPayUrl };
    } else if (item.paymentStatus === 'AWAITING_SLIP') {
      buttonColor = '#f59e0b';
      buttonLabel = '⏳ รอตรวจสอบ';
      action = { type: 'uri', label: buttonLabel, uri: liffPayUrl };
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
            text: item.name,
            weight: 'bold',
            size: 'md',
            color: '#374151',
            wrap: true,
            align: 'center',
            margin: 'md'
          },
          {
            type: 'text',
            text: `ยอดเงิน: ฿${Number(item.amount).toLocaleString()}`,
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

  return {
    type: 'flex',
    altText: `เลือกงวดชำระเงินค่าห้อง ${room.name}`,
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };
}

export async function handleShowPaymentItems(event, lineClient) {
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

  const carouselMsg = await buildPaymentItemsMessage(room, userId, prisma);
  if (!carouselMsg) return;

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [carouselMsg]
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
          payments: {
            where: { status: 'APPROVED' },
            select: { amount: true }
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
        totalPaid = room.payments.reduce((sum, p) => sum + p.amount, 0);
        periodCount = room.payments.length;
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
            payments: {
              where: { status: 'APPROVED' },
              select: { amount: true }
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
        totalPaid = r.payments.reduce((sum, p) => sum + p.amount, 0);
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
    return handleShowPaymentItems(event, lineClient);
  }

  // ===== 4. fallback สำหรับข้อความที่ไม่รู้จัก =====
  // return lineClient.replyMessage({
  //   replyToken,
  //   messages: [{ type: 'text', text: UNKNOWN_COMMAND }]
  // });
}
