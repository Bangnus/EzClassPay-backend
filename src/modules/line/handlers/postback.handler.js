import prisma from "../../../config/database.js";

export async function handlePostback(event, lineClient) {
  const userId = event.source.userId;
  const data = new URLSearchParams(event.postback.data);
  
  if (data.get('action') === 'pay') {
    const periodId = data.get('period_id');
    
    const period = await prisma.period.findUnique({
      where: { id: periodId },
      include: { room: true }
    });

    if (!period) return;

    // สร้างประวัติ Payment เอาไว้รอรับสลิป
    await prisma.payment.create({
      data: {
        periodId: period.id,
        lineUid: userId,
        status: 'AWAITING_SLIP'
      }
    });

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: `กรุณาโอนเงินจำนวน ${period.amount} บาท\nไปยังพร้อมเพย์: ${period.room.promptpayNo}\n\n👉 โอนเสร็จแล้ว ส่งรูปสลิปเข้ามาในแชทนี้ได้เลยครับ 📸`
      }]
    });
  }
}
