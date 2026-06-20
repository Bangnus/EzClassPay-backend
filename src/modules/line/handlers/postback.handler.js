import prisma from "../../../config/database.js";
import { handleSwitchRoom, handleSelectRoom, handleLeaveRoom } from "./richmenu.handler.js";
import { handleShowPeriods, buildPeriodsCarouselMessage } from "./text.handler.js";
import { PERIOD_NOT_FOUND, paymentDetail, SEND_SLIP_PROMPT, NO_MEMBERSHIP } from "../../../constants/messages.js";
import { RICH_MENU } from "../../../constants/richmenu.js";

export async function handlePostback(event, lineClient) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  console.log(`[RICH_MENU_POSTBACK] action=${action}`, {
    userId: event.source.userId,
    groupId: event.source.groupId,
    data: event.postback.data,
  });

  if (action === 'switch_room') {
    return handleSwitchRoom(event, lineClient);
  }

  if (action === 'select_room') {
    return handleSelectRoom(event, lineClient);
  }

  if (action === 'leave_room') {
    return handleLeaveRoom(event, lineClient);
  }

  if (action === 'group_pay_check') {
    const groupId = data.get('group_id');
    const userId = event.source.userId;

    const room = await prisma.room.findUnique({
      where: { lineGroupId: groupId }
    });

    if (!room) return;

    const user = await prisma.user.findUnique({ where: { lineUid: userId } });
    if (!user) return;

    // 1. Link Rich Menu
    await prisma.user.update({
      where: { lineUid: userId },
      data: { activeRoomId: room.id }
    });

    const isManager = room.managerId === user.id;
    if (isManager) {
      await lineClient.linkRichMenuIdToUser(userId, RICH_MENU.MANAGER);
    } else {
      await lineClient.linkRichMenuIdToUser(userId, RICH_MENU.MEMBER);
    }

    // 2. Build Unpaid Summary
    let unpaidTotal = 0;
    if (room.collectionType === 'MONTHLY') {
      const bills = await prisma.bill.findMany({
        where: { roomId: room.id, userId: user.id, status: 'UNPAID' }
      });
      unpaidTotal = bills.reduce((sum, b) => sum + b.amount, 0);
    } else {
      const periods = await prisma.period.findMany({
        where: { roomId: room.id },
        include: {
          payments: { where: { lineUid: userId } }
        }
      });
      for (const p of periods) {
        const approved = p.payments.some(pay => pay.status === 'APPROVED');
        if (!approved) {
          unpaidTotal += p.amount;
        }
      }
    }

    const summaryText = `ยอดค้างชำระของคุณในห้อง "${room.name}" คือ ฿${unpaidTotal.toLocaleString()}`;

    // 3. Build Periods Carousel
    const carouselMsg = await buildPeriodsCarouselMessage(room, event.source.userId, prisma);

    const messages = [];
    
    // Add Summary Text Message
    messages.push({
      type: 'text',
      text: summaryText
    });

    if (carouselMsg) {
      messages.push(carouselMsg);
    }

    try {
      await lineClient.pushMessage(event.source.userId, messages);
      const botLineUrl = `https://line.me/R/ti/p/${process.env.LINE_BOT_ID || '@ไอดีบอท'}`;
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `ส่งรายละเอียดค่าห้องไปที่แชทส่วนตัวแล้วครับ 📬\n\nแตะที่ลิงก์ด้านล่างเพื่อตรวจสอบและชำระเงินได้เลยครับ:\n${botLineUrl}`
        }]
      });
    } catch (error) {
      console.error('Failed to push message:', error);
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `ไม่สามารถส่งข้อความไปที่แชทส่วนตัวได้ครับ รบกวนเพิ่มบอทเป็นเพื่อนก่อนนะครับ`
        }]
      });
    }
  }

  if (action === 'pay') {
    const periodId = data.get('period_id');
    const billId = data.get('bill_id');

    if (!periodId && !billId) {
      // Rich Menu pay → send LIFF URL or Carousel
      const user = await prisma.user.findUnique({ where: { lineUid: event.source.userId } });
      if (!user) return;

      const groupId = event.source.groupId;
      let room;

      if (groupId) {
        room = await prisma.room.findUnique({ where: { lineGroupId: groupId } });
      } else {
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
          messages: [{ type: 'text', text: NO_MEMBERSHIP }]
        });
      }

      const carouselMsg = await buildPeriodsCarouselMessage(room, event.source.userId, prisma);
      if (!carouselMsg) return;

      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [carouselMsg]
      });
    }

    let periodName, amount, promptpayNo, roomId, roomName;

    if (periodId) {
      const period = await prisma.period.findUnique({
        where: { id: periodId },
        include: { room: true }
      });

      if (!period) {
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: PERIOD_NOT_FOUND }]
        });
      }

      const existing = await prisma.payment.findFirst({
        where: { periodId: period.id, lineUid: event.source.userId, status: 'AWAITING_SLIP' }
      });

      if (!existing) {
        await prisma.payment.create({
          data: {
            periodId: period.id,
            roomId: period.roomId,
            lineUid: event.source.userId,
            status: 'AWAITING_SLIP'
          }
        });
      }

      periodName = period.name;
      amount = period.amount;
      promptpayNo = period.room.promptpayNo;
      roomId = period.roomId;
      roomName = period.room.name;
    } else if (billId) {
      const bill = await prisma.bill.findUnique({
        where: { id: billId },
        include: { room: true }
      });

      if (!bill) {
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: PERIOD_NOT_FOUND }]
        });
      }

      const existing = await prisma.payment.findFirst({
        where: { roomId: bill.roomId, lineUid: event.source.userId, status: 'AWAITING_SLIP' }
      });

      if (!existing) {
        await prisma.payment.create({
          data: {
            roomId: bill.roomId,
            lineUid: event.source.userId,
            status: 'AWAITING_SLIP'
          }
        });
      }

      periodName = `บิลเดือน ${bill.month}/${bill.year}`;
      amount = bill.amount;
      promptpayNo = bill.room.promptpayNo;
      roomId = bill.roomId;
      roomName = bill.room.name;
    }

    const qrUrl = `https://promptpay.io/${promptpayNo}.png`;

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'flex',
          altText: `คิวอาร์โค้ดชำระเงิน ${periodName}`,
          contents: {
            type: 'bubble',
            size: 'mega',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#16a085',
              paddingTop: '16px',
              paddingBottom: '16px',
              contents: [
                {
                  type: 'text',
                  text: '📲 สแกน QR เพื่อชำระเงิน',
                  weight: 'bold',
                  size: 'lg',
                  color: '#ffffff',
                  align: 'center'
                }
              ]
            },
            hero: {
              type: 'image',
              url: qrUrl,
              size: 'full',
              aspectRatio: '1:1',
              aspectMode: 'cover'
            },
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: 'xl',
              contents: [
                {
                  type: 'text',
                  text: periodName,
                  weight: 'bold',
                  size: 'xl',
                  color: '#16a085',
                  wrap: true,
                  align: 'center'
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  margin: 'lg',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: 'ยอดเงิน',
                          color: '#6b7280',
                          size: 'sm',
                          flex: 0
                        },
                        {
                          type: 'text',
                          text: `฿${Number(amount).toLocaleString()}`,
                          weight: 'bold',
                          color: '#00c6ae',
                          size: 'lg',
                          align: 'end',
                          flex: 1
                        }
                      ]
                    },
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: 'พร้อมเพย์',
                          color: '#6b7280',
                          size: 'sm',
                          flex: 0
                        },
                        {
                          type: 'text',
                          text: promptpayNo,
                          weight: 'bold',
                          color: '#111827',
                          size: 'md',
                          align: 'end',
                          flex: 1
                        }
                      ]
                    }
                  ]
                },
                {
                  type: 'separator',
                  margin: 'xl',
                  color: '#e5e7eb'
                },
                {
                  type: 'text',
                  text: SEND_SLIP_PROMPT,
                  wrap: true,
                  color: '#6b7280',
                  size: 'xs',
                  align: 'center',
                  margin: 'lg'
                }
              ]
            }
          }
        }
      ]
    });
  }
}
