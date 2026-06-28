import prisma from "../../../config/database.js";
import { uploadToS3 } from "../../../utils/s3.js";
import { lineClient } from "../line.service.js";
import { NO_PENDING_SLIP, slipSaved, SLIP_ERROR } from "../../../constants/messages.js";

export async function handleImage(event, lineClient, blobClient) {
  const userId = event.source.userId;

  const pendingPayment = await prisma.payment.findFirst({
    where: { lineUid: userId, status: "AWAITING_SLIP" },
    orderBy: { createdAt: "desc" },
    include: {
      room: {
        select: { id: true, name: true, lineGroupId: true, promptpayNo: true },
      },
    },
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

    const userProfile = await lineClient.getProfile(userId);
    const roomName = pendingPayment.room?.name || "";

    try {
      await lineClient.pushMessage({
        to: userId,
        messages: [
          {
            type: "flex",
            altText: `📄 สลิปของคุณรอตรวจสอบ`,
            contents: {
              type: "bubble",
              size: "mega",
              header: {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "📄 สลิปใหม่รอตรวจสอบ",
                    weight: "bold",
                    size: "md",
                    color: "#ea580c",
                    align: "center",
                  },
                ],
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                paddingAll: "sm",
                contents: [
                  {
                    type: "text",
                    text: roomName,
                    weight: "bold",
                    size: "xl",
                    color: "#111827",
                    wrap: true,
                    align: "center",
                  },
                  { type: "separator" },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "ผู้โอน", weight: "bold", size: "sm", flex: 1, color: "#6b7280" },
                      { type: "text", text: userProfile.displayName, size: "sm", flex: 3, color: "#111827", wrap: true },
                    ],
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "สถานะ", weight: "bold", size: "sm", flex: 1, color: "#6b7280" },
                      { type: "text", text: "รอตรวจสอบ", size: "sm", flex: 3, color: "#ea580c", weight: "bold" },
                    ],
                  },
                  { type: "separator" },
                  {
                    type: "text",
                    text: "กรุณาตรวจสอบสลิปและยืนยันการชำระเงิน 🙏",
                    size: "sm",
                    color: "#9ca3af",
                    wrap: true,
                  },
                ],
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                paddingAll: "sm",
                contents: [
                  {
                    type: "button",
                    action: {
                      type: "uri",
                      label: "ตรวจสอบและอนุมัติ",
                      uri: `https://liff.line.me/${process.env.LIFF_ID_VERIFY_SLIP}?roomId=${pendingPayment.room.id}&lineGroupId=${pendingPayment.room.lineGroupId}`,
                    },
                    style: "primary",
                    color: "#ea580c",
                    height: "sm",
                  },
                ],
              },
            },
          },
        ],
      });
    } catch (e) {
      console.error("Failed to send private notification:", e.message);
    }

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: slipSaved(roomName),
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
