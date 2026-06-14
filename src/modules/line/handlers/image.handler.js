import prisma from "../../../config/database.js";
import { uploadToS3 } from "../../../utils/s3.js";

export async function handleImage(event, lineClient, blobClient) {
  const userId = event.source.userId;

  const pendingPayment = await prisma.payment.findFirst({
    where: { lineUid: userId, status: "AWAITING_SLIP" },
    orderBy: { createdAt: "desc" },
    include: { period: true },
  });

  if (!pendingPayment) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: "text",
        text: "❌ ไม่พบรายการรอสลิป กรุณากด \"💸 จ่ายเงิน\" เพื่อเลือกงวดที่ต้องการจ่ายก่อนครับ"
      }]
    });
  }

  try {
    const stream = await blobClient.getMessageContent(event.message.id);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const slipUrl = await uploadToS3(
      buffer,
      `${event.message.id}.jpg`,
      "image/jpeg",
    );

    await prisma.payment.update({
      where: { id: pendingPayment.id },
      data: { status: "PENDING", slipUrl },
    });

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `✅ บันทึกสลิปสำหรับ "${pendingPayment.period.name}" เรียบร้อยแล้วครับ!\nแอดมินจะทำการตรวจสอบเร็วๆ นี้ครับ ⏳`,
        },
      ],
    });
  } catch (error) {
    console.error("Error handling slip upload:", error);
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `❌ ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกรูปภาพ กรุณาลองใหม่อีกครั้ง`,
        },
      ],
    });
  }
}
