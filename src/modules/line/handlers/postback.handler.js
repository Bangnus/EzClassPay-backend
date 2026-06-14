import prisma from "../../../config/database.js";
import { handleSwitchRoom, handleSelectRoom } from "./richmenu.handler.js";
import { handleShowPeriods } from "./text.handler.js";

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
        messages: [{ type: 'text', text: 'ไม่พบข้อมูลงวดนี้ กรุณาลองใหม่อีกครั้งครับ' }]
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
          text: `📋 รายการ: ${period.name}\n💰 ยอดโอน: ${period.amount} บาท\n🏦 พร้อมเพย์: ${promptpayNo}`
        },
        {
          type: 'image',
          originalContentUrl: qrUrl,
          previewImageUrl: qrUrl
        },
        {
          type: 'text',
          text: '👉 โอนเสร็จแล้ว ส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ 📸'
        }
      ]
    });
  }
}
