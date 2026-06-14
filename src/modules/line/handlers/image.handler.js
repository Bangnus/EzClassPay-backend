import prisma from "../../../config/database.js";
import { uploadToS3 } from "../../../utils/s3.js";

export async function handleImage(event, lineClient, blobClient) {
  const userId = event.source.userId;

  // หาว่าเขามีบิลที่รอสลิปอยู่ไหม? (เอาล่าสุด)
  const pendingPayment = await prisma.payment.findFirst({
    where: { lineUid: userId, status: "AWAITING_SLIP" },
    orderBy: { createdAt: "desc" },
    include: { period: true },
  });

  if (pendingPayment) {
    try {
      // ดาวน์โหลดรูปจาก LINE Server
      const stream = await blobClient.getMessageContent(event.message.id);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      // อัปโหลดขึ้น S3
      const slipUrl = await uploadToS3(
        buffer,
        `${event.message.id}.jpg`,
        "image/jpeg",
      );

      // อัปเดตสถานะเป็น PENDING (รอแอดมินตรวจ)
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
}
