import prisma from "../../../config/database.js";
import { handleSwitchRoom, handleSelectRoom, handleLeaveRoom } from "./richmenu.handler.js";
import { handleShowPeriods } from "./text.handler.js";
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

    // 3. Build Periods Carousel (same as action=pay)
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

    const bubbles = periods.map(period => {
      const payment = period.payments[0];
      const isPaid = payment && payment.status === 'APPROVED';
      const isPending = payment && payment.status === 'AWAITING_SLIP';
      
      let buttonStyle = 'primary';
      let buttonColor = '#00c6ae';
      let buttonLabel = '💳 เลือกชำระงวดนี้';
      let payAction = { type: 'postback', label: buttonLabel, data: `action=pay&period_id=${period.id}` };

      if (isPaid) {
        buttonColor = '#16a34a'; // green
        buttonLabel = '✅ ชำระแล้ว';
        payAction = { type: 'uri', label: buttonLabel, uri: 'https://line.me/R/' }; // dummy action
      } else if (isPending) {
        buttonColor = '#f59e0b'; // amber
        buttonLabel = '⏳ รอตรวจสอบ';
        payAction = { type: 'postback', label: buttonLabel, data: `action=pay&period_id=${period.id}` };
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
            action: payAction
          }]
        }
      };
    });

    const messages = [];
    
    // Add Summary Text Message
    messages.push({
      type: 'text',
      text: summaryText
    });

    // Add Periods Carousel (or a text message if no periods)
    if (periods.length === 0) {
      messages.push({
        type: 'text',
        text: "ยังไม่มีงวดชำระเงินในห้องนี้ครับ"
      });
    } else {
      messages.push({
        type: 'flex',
        altText: `เลือกงวดชำระเงินค่าห้อง ${room.name}`,
        contents: {
          type: 'carousel',
          contents: bubbles
        }
      });
    }

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: messages
    });
  }

  if (action === 'pay') {
    const periodId = data.get('period_id');

    if (!periodId) {
      // Rich Menu pay → send LIFF URL
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
          lineUid: event.source.userId,
          status: 'AWAITING_SLIP'
        }
      });
    }

    const promptpayNo = period.room.promptpayNo;
    const qrUrl = `https://promptpay.io/${promptpayNo}.png`;

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'flex',
          altText: `คิวอาร์โค้ดชำระเงิน ${period.name}`,
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
                  text: period.name,
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
                          text: `฿${Number(period.amount).toLocaleString()}`,
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
