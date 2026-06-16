import * as paymentRepo from "./payment.repository.js";
import * as billRepo from "../bills/bill.repository.js";
import { lineClient } from "../line/line.service.js";

export async function initiatePayment({ lineUid, roomId, amount }) {
  const payment = await paymentRepo.createPayment({
    lineUid,
    roomId,
    status: "AWAITING_SLIP",
  });

  try {
    const room = await paymentRepo.findRoomById(roomId);
    const userProfile = await lineClient.getProfile(lineUid).catch(() => null);

    await lineClient.pushMessage({
      to: lineUid,
      messages: [
        {
          type: "flex",
          altText: "💸 เตรียมส่งสลิป",
          contents: {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "💸 พร้อมส่งสลิปแล้ว",
                  weight: "bold",
                  size: "xl",
                  color: "#ea580c",
                  align: "center",
                },
              ],
            },
            body: {
              type: "box",
              layout: "vertical",
              spacing: "md",
              contents: [
                {
                  type: "text",
                  text: room?.name || "ห้อง",
                  weight: "bold",
                  size: "xxl",
                  color: "#111827",
                  align: "center",
                  wrap: true,
                },
                { type: "separator" },
                {
                  type: "box",
                  layout: "baseline",
                  spacing: "sm",
                  contents: [
                    { type: "text", text: "สถานะ", weight: "bold", size: "sm", flex: 1, color: "#6b7280" },
                    { type: "text", text: "⏳ รอสลิป", size: "sm", flex: 3, color: "#ea580c", weight: "bold" },
                  ],
                },
                { type: "separator" },
                {
                  type: "text",
                  text: "📸 กรุณาส่งรูปสลิปโอนเงินเข้ามาในแชทนี้ เพื่อให้ผู้ดูแลตรวจสอบครับ 🙏",
                  size: "xs",
                  color: "#9ca3af",
                  wrap: true,
                },
              ],
            },
          },
        },
      ],
    });
  } catch (e) {
    console.error("Failed to send initiate notification:", e.message);
  }

  return payment;
}

export async function approvePayment(paymentId) {
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) {
    const error = new Error("Payment not found");
    error.statusCode = 404;
    throw error;
  }

  const updated = await paymentRepo.updateStatus(paymentId, "APPROVED");

  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const bills = await billRepo.findBillsByRoomAndMonth(payment.room.id, month, year);
    const userBill = bills.find(b => b.userId === payment.user.id && b.status === "UNPAID");
    if (userBill) {
      await billRepo.updateBillStatus(userBill.id, "PAID");
    }
  } catch (e) {
    console.error("Failed to update bill status:", e.message);
  }

  try {
    await lineClient.pushMessage({
      to: payment.user.lineUid,
      messages: [
        {
          type: "text",
          text: `✅ สลิปการชำระเงินสำหรับห้อง "${payment.room.name}" ถูกอนุมัติแล้วครับ!`,
        },
      ],
    });
  } catch (e) {
    console.error("Failed to notify user of approval:", e.message);
  }

  return updated;
}

export async function rejectPayment(paymentId) {
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) {
    const error = new Error("Payment not found");
    error.statusCode = 404;
    throw error;
  }

  const updated = await paymentRepo.updateStatus(paymentId, "REJECTED");

  try {
    await lineClient.pushMessage({
      to: payment.user.lineUid,
      messages: [
        {
          type: "text",
          text: `❌ สลิปการชำระเงินสำหรับห้อง "${payment.room.name}" ถูกปฏิเสธ กรุณาติดต่อผู้ดูแลห้องครับ`,
        },
      ],
    });
  } catch (e) {
    console.error("Failed to notify user of rejection:", e.message);
  }

  return updated;
}

export async function getPaymentHistory(roomId) {
  return paymentRepo.findByRoom(roomId);
}

export async function getPendingPayments(roomId) {
  return paymentRepo.findPendingByRoom(roomId);
}
