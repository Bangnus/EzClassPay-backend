import * as paymentRepo from "./payment.repository.js";
import * as billRepo from "../bills/bill.repository.js";
import { lineClient } from "../line/line.service.js";

export async function initiatePayment({ lineUid, roomId, amount }) {
  const payment = await paymentRepo.createPayment({
    lineUid,
    roomId,
    status: "AWAITING_SLIP",
  });
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
