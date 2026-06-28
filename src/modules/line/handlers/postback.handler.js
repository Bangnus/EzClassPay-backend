import prisma from "../../../config/database.js";
import { handleSwitchRoom, handleSelectRoom, handleLeaveRoom } from "./richmenu.handler.js";
import { handleShowPaymentItems, buildPaymentItemsMessage } from "./text.handler.js";
import { SEND_SLIP_PROMPT, NO_MEMBERSHIP } from "../../../constants/messages.js";
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

  if (action === 'subscribe') {
    const roomId = data.get('room_id');
    const userId = event.source.userId;

    const user = await prisma.user.findUnique({ where: { lineUid: userId } });
    if (!user) return;

    try {
      // Import needs to be updated at the top as well, but assuming createPromptPayIntent is imported correctly
      // Wait, I need to make sure createPromptPayIntent is imported instead of createCheckoutSession.
      // Let's use the new function from subscriptionService directly.
      const { createPromptPayIntent } = await import('../../subscriptions/subscription.service.js');
      const { qrCodeUrl, hostedInstructionsUrl, amount } = await createPromptPayIntent(roomId, user.id);

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      const roomName = room?.name || 'ห้องของคุณ';

      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: 'flex',
            altText: `คิวอาร์โค้ดชำระค่าบริการ ${roomName}`,
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
                    text: '📲 สแกน QR เพื่อชำระค่าบริการ',
                    weight: 'bold',
                    size: 'lg',
                    color: '#ffffff',
                    align: 'center'
                  }
                ]
              },
              hero: {
                type: 'image',
                url: qrCodeUrl,
                size: 'full',
                aspectRatio: '1:1',
                aspectMode: 'cover',
                action: {
                  type: 'uri',
                  label: 'เปิดรูปภาพ',
                  uri: qrCodeUrl
                }
              },
              body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: 'xl',
                contents: [
                  {
                    type: 'text',
                    text: `ต่ออายุ 30 วัน`,
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
                      }
                    ]
                  },
                  {
                    type: 'button',
                    margin: 'lg',
                    style: 'primary',
                    color: '#00c6ae',
                    height: 'sm',
                    action: {
                      type: 'uri',
                      label: '📥 เปิดหน้าชำระเงิน',
                      uri: hostedInstructionsUrl || qrCodeUrl
                    }
                  },
                  {
                    type: 'separator',
                    margin: 'xl',
                    color: '#e5e7eb'
                  },
                  {
                    type: 'text',
                    text: 'สแกนจ่ายผ่านแอปธนาคารใดก็ได้\nเมื่อชำระสำเร็จ ห้องจะปลดล็อคอัตโนมัติครับ',
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
        ],
      });
    } catch (err) {
      console.error('[Subscribe] Error:', err.message);
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `เกิดข้อผิดพลาด: ${err.message}` }],
      });
    }
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
      const approvedPayment = await prisma.payment.findFirst({
        where: { roomId: room.id, lineUid: userId, status: 'APPROVED' }
      });
      if (!approvedPayment) {
        unpaidTotal = room.totalTargetAmount || 0;
      }
    }

    const summaryText = `ยอดค้างชำระของคุณในห้อง "${room.name}" คือ ฿${unpaidTotal.toLocaleString()}`;

    // 3. Build Payment Items Carousel
    const carouselMsg = await buildPaymentItemsMessage(room, event.source.userId, prisma);

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
      await lineClient.pushMessage({
        to: event.source.userId,
        messages: messages
      });
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
      const errorData = error.originalError?.response?.data;
      const errorMsg = errorData?.message || error.message || 'Unknown error';
      const errorDetails = errorData?.details ? JSON.stringify(errorData.details) : '';
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `ไม่สามารถส่งข้อความไปที่แชทส่วนตัวได้ครับ: ${errorMsg}\nรายละเอียด: ${errorDetails}`
        }]
      });
    }
  }

  if (action === 'pay') {
    const type = data.get('type');
    const billId = data.get('bill_id');

    if (!type && !billId) {
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

      const carouselMsg = await buildPaymentItemsMessage(room, event.source.userId, prisma);
      if (!carouselMsg) return;

      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [carouselMsg]
      });
    }

    let itemName, amount, promptpayNo, roomId, roomName;

    if (type === 'target') {
      const roomIdParam = data.get('room_id');
      const room = await prisma.room.findUnique({
        where: { id: roomIdParam }
      });

      if (!room) {
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: 'ไม่พบข้อมูลห้อง กรุณาลองใหม่อีกครั้ง' }]
        });
      }

      const existing = await prisma.payment.findFirst({
        where: { roomId: room.id, lineUid: event.source.userId, status: { in: ['AWAITING_SLIP', 'PENDING'] } },
        orderBy: { createdAt: 'desc' }
      });

      if (existing && existing.status === 'PENDING') {
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: 'คุณได้ส่งสลิปชำระเงินแล้ว สถานะกำลังรอการตรวจสอบจากผู้ดูแลครับ' }]
        });
      }

      if (!existing) {
        await prisma.payment.create({
          data: {
            roomId: room.id,
            lineUid: event.source.userId,
            amount: room.totalTargetAmount || 0,
            status: 'AWAITING_SLIP'
          }
        });
      }

      itemName = 'เป้าหมายรวม';
      amount = room.totalTargetAmount || 0;
      promptpayNo = room.promptpayNo;
      roomId = room.id;
      roomName = room.name;
    } else if (billId) {
      const bill = await prisma.bill.findUnique({
        where: { id: billId },
        include: { room: true }
      });

      if (!bill) {
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: 'ไม่พบข้อมูลบิล กรุณาลองใหม่อีกครั้ง' }]
        });
      }

      const existing = await prisma.payment.findFirst({
        where: { billId: bill.id, lineUid: event.source.userId, status: { in: ['AWAITING_SLIP', 'PENDING', 'APPROVED'] } },
        orderBy: { createdAt: 'desc' }
      });

      if (existing) {
        if (existing.status === 'PENDING') {
          return lineClient.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: 'คุณได้ส่งสลิปชำระเงินสำหรับงวดนี้แล้ว สถานะกำลังรอการตรวจสอบจากผู้ดูแลครับ' }]
          });
        }
        if (existing.status === 'APPROVED') {
          return lineClient.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: 'งวดนี้ได้รับการอนุมัติการชำระเงินเรียบร้อยแล้วครับ' }]
          });
        }
      }

      if (!existing) {
        await prisma.payment.create({
          data: {
            billId: bill.id,
            roomId: bill.roomId,
            lineUid: event.source.userId,
            amount: bill.amount,
            status: 'AWAITING_SLIP'
          }
        });
      }

      itemName = `บิลเดือน ${bill.month}/${bill.year}`;
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
          altText: `คิวอาร์โค้ดชำระเงิน ${itemName}`,
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
                  text: itemName,
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
