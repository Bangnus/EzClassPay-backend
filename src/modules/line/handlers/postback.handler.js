import prisma from "../../../config/database.js";
import { handleSwitchRoom, handleSelectRoom } from "./richmenu.handler.js";
import { handleShowPeriods } from "./text.handler.js";
import { PERIOD_NOT_FOUND, paymentDetail, SEND_SLIP_PROMPT, NO_MEMBERSHIP } from "../../../constants/messages.js";

export async function handlePostback(event, lineClient) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  if (action === 'switch_room') {
    return handleSwitchRoom(event, lineClient);
  }

  if (action === 'select_room') {
    return handleSelectRoom(event, lineClient);
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
          type: 'text',
          text: paymentDetail(period.name, period.amount, promptpayNo)
        },
        {
          type: 'image',
          originalContentUrl: qrUrl,
          previewImageUrl: qrUrl
        },
        {
          type: 'text',
          text: SEND_SLIP_PROMPT
        }
      ]
    });
  }
}
