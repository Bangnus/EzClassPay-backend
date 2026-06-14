import prisma from "../../../config/database.js";
import { uploadToS3 } from "../../../utils/s3.js";
import { NO_PENDING_SLIP, slipSaved, SLIP_ERROR } from "../../../constants/messages.js";

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
      messages: [{ type: "text", text: NO_PENDING_SLIP }]
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
          text: slipSaved(pendingPayment.period.name),
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
          text: SLIP_ERROR,
        },
      ],
    });
  }
}
