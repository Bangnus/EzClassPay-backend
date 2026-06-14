import prisma from "../../../config/database.js";
import { handleShowRooms } from "./richmenu.handler.js";

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
      messages: [{ type: 'text', text: 'ยังไม่มีรายการงวดที่ต้องจ่ายในขณะนี้ครับ 🎉' }]
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
      statusText = 'รอจ่าย';
      statusColor = '#ff334b';
      badgeColor = '#ff334b';
      showPayButton = true;
    } else if (payment.status === 'APPROVED') {
      statusText = 'จ่ายแล้ว';
      statusColor = '#00c300';
      badgeColor = '#00c300';
      showPayButton = false;
    } else if (payment.status === 'PENDING') {
      statusText = 'รอตรวจสอบ';
      statusColor = '#ffb81c';
      badgeColor = '#ffb81c';
      showPayButton = false;
    } else {
      statusText = 'รอสลิป';
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
              { type: 'text', text: 'ยอดที่ต้องจ่าย', color: '#8c8c8c', size: 'sm', flex: 1 },
              { type: 'text', text: `฿${period.amount}`, color: '#333333', size: 'sm', flex: 1, align: 'end', weight: 'bold' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'สถานะ', color: '#8c8c8c', size: 'sm', flex: 1 },
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
              label: '💸 กดเพื่อจ่ายงวดนี้',
              data: `action=pay&period_id=${period.id}`,
              displayText: `กำลังจ่าย ${period.name}`
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
      altText: 'รายการงวดที่ต้องชำระเงิน',
      contents: { type: 'carousel', contents: bubbles }
    }]
  });
}

export async function handleText(event, lineClient) {
  const text = event.message.text.trim();
  const replyToken = event.replyToken;
  const isGroupChat = event.source.type === 'group';

  // debug: log ข้อความที่ได้รับ
  console.log('[handleText] received:', JSON.stringify(text), 'group:', isGroupChat);

  if (isGroupChat && text.match(/^@[Ee][Zz][Cc]lass[Pp]ay/)) {
    const botLineUrl = `https://line.me/R/ti/p/${process.env.LINE_BOT_ID || '@ไอดีบอท'}`;

    return lineClient.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: 'สวัสดีครับ! เรียกใช้ EzClassPay มีอะไรให้ผมช่วยไหมครับ? เลือกเมนูด้านล่างได้เลย 👇',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'uri',
                label: '💸 จ่ายเงิน/เช็กยอด',
                uri: botLineUrl
              }
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '📊 ดูยอดรวม',
                text: 'ดูยอดรวม'
              }
            }
          ]
        }
      }]
    });
  }

  if (isGroupChat && text === 'ดูยอดรวม') {
    const groupId = event.source.groupId;

    const room = await prisma.room.findUnique({
      where: { lineGroupId: groupId },
      include: {
        periods: {
          include: {
            payments: {
              where: { status: 'APPROVED' }
            }
          }
        }
      }
    });

    if (!room) {
      return lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: 'ยังไม่ได้ตั้งค่าห้องนี้ในระบบครับ รบกวนผู้ดูแลดำเนินการก่อน 🙏' }]
      });
    }

    const totalTarget = room.totalTargetAmount || 0;
    const totalPaid = room.periods.reduce((sum, p) => {
      return sum + p.payments.length * p.amount;
    }, 0);

    return lineClient.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: `📊 สรุปยอดห้อง "${room.name}"\n\n💰 เก็บได้แล้ว: ${totalPaid} บาท\n📌 เป้าหมาย: ${totalTarget > 0 ? totalTarget + ' บาท' : 'ไม่ได้ตั้งเป้า'}\n📆 จำนวนงวด: ${room.periods.length} งวด`
      }]
    });
  }

  if (text === 'แสดงห้องทั้งหมด') {
    return handleShowRooms(event, lineClient);
  }

  if (text === 'คู่มือการใช้งาน') {
    return lineClient.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: '📖 คู่มือการใช้งาน EzClassPay\n\n1️⃣ เพิ่มบอทเข้าห้อง LINE\n2️⃣ ตั้งค่าห้องผ่าน LIFF\n3️⃣ สร้างงวดเก็บเงิน\n4️⃣ ลูกบ้านกด "💸 จ่ายเงิน"\n5️⃣ ส่งสลิปเพื่อยืนยัน\n\n📌 สอบถามเพิ่มเติม: ติดต่อผู้ดูแลระบบ'
      }]
    });
  }

  if (text === 'แจ้งโอนเงิน' || text === 'จ่ายเงิน') {
    return handleShowPeriods(event, lineClient);
  }
}
