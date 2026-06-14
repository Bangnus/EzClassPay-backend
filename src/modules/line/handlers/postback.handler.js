import prisma from "../../../config/database.js";
import { handleSwitchRoom, handleSelectRoom } from "./richmenu.handler.js";
import { handleShowPeriods } from "./text.handler.js";
import { PERIOD_NOT_FOUND, paymentDetail, SEND_SLIP_PROMPT } from "../../../constants/messages.js";

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
      return handleShowPeriods(event, lineClient);
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
