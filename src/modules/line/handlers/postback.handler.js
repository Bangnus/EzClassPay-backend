import prisma from "../../../config/database.js";
import { handleSwitchRoom, handleSelectRoom, handleLeaveRoom } from "./richmenu.handler.js";
import { handleShowPeriods } from "./text.handler.js";
import { PERIOD_NOT_FOUND, paymentDetail, SEND_SLIP_PROMPT, NO_MEMBERSHIP } from "../../../constants/messages.js";

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
        const membership = await prisma.roomMember.findFirst({
          where: { userId: user.id },
          include: { room: true }
        });
        room = membership?.room;
      }

      if (!room) {
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: NO_MEMBERSHIP }]
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
            size: 'mega',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#00c6ae',
              paddingTop: '16px',
              paddingBottom: '16px',
              contents: [
                {
                  type: 'text',
                  text: '💸 ชำระเงินค่าห้อง',
                  weight: 'bold',
                  size: 'lg',
                  color: '#ffffff',
                  align: 'center'
                }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: 'xl',
              contents: [
                {
                  type: 'text',
                  text: room.name,
                  weight: 'bold',
                  size: 'xl',
                  color: '#16a085',
                  wrap: true,
                  align: 'center'
                },
                {
                  type: 'separator',
                  margin: 'xl',
                  color: '#e5e7eb'
                },
                {
                  type: 'text',
                  text: 'กรุณากดปุ่มด้านล่างเพื่อเข้าสู่ระบบชำระเงินและส่งสลิปครับ 🙏',
                  wrap: true,
                  color: '#6b7280',
                  size: 'sm',
                  align: 'center',
                  margin: 'lg'
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              paddingAll: 'md',
              contents: [{
                type: 'button',
                style: 'primary',
                color: '#00c6ae',
                height: 'sm',
                action: { type: 'uri', label: '💳 ชำระเงินตอนนี้', uri: liffUrl }
              }]
            }
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
