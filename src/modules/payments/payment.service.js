import * as paymentRepo from "./payment.repository.js";
import * as billRepo from "../bills/bill.repository.js";
import { lineClient } from "../line/line.service.js";
import prisma from "../../config/database.js";

export async function initiatePayment({ lineUid, roomId, amount, billId }) {
  // Check for existing payment to prevent duplicates
  const whereClause = billId
    ? { billId, lineUid, status: { in: ["AWAITING_SLIP", "PENDING"] } }
    : { roomId, billId: null, lineUid, status: { in: ["AWAITING_SLIP", "PENDING"] } };

  const existing = await prisma.payment.findFirst({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // Already has a pending payment, return the existing one
    return existing;
  }

  // Also check if already approved
  const approvedWhere = billId
    ? { billId, lineUid, status: "APPROVED" }
    : { roomId, billId: null, lineUid, status: "APPROVED" };

  const approved = await prisma.payment.findFirst({ where: approvedWhere });
  if (approved) {
    const err = new Error("งวดนี้ได้รับการอนุมัติการชำระเงินเรียบร้อยแล้วครับ");
    err.statusCode = 409;
    throw err;
  }

  const paymentData = {
    lineUid,
    roomId,
    amount: amount || 0,
    status: "AWAITING_SLIP",
  };
  if (billId) paymentData.billId = billId;

  const payment = await paymentRepo.createPayment(paymentData);

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
            size: "mega",
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#f0fdf4",
              paddingTop: "12px",
              paddingBottom: "12px",
              contents: [
                {
                  type: "text",
                  text: "💸 พร้อมส่งสลิปแล้ว",
                  weight: "bold",
                  size: "md",
                  color: "#16a34a",
                  align: "center",
                },
              ],
            },
            body: {
              type: "box",
              layout: "vertical",
              paddingAll: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: room?.name || "ห้อง",
                  weight: "bold",
                  size: "md",
                  color: "#111827",
                  align: "center",
                  wrap: true,
                },
                {
                  type: "box",
                  layout: "horizontal",
                  spacing: "sm",
                  contents: [
                    { type: "text", text: "สถานะ", size: "sm", color: "#6b7280", flex: 0 },
                    { type: "text", text: "⏳ รอสลิป", size: "sm", color: "#16a34a", weight: "bold", align: "end", flex: 1 },
                  ],
                },
                {
                  type: "text",
                  text: "📸 ส่งรูปสลิปในแชทนี้เพื่อให้ผู้ดูแลตรวจสอบ",
                  size: "xs",
                  color: "#9ca3af",
                  wrap: true,
                  margin: "md",
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

  // Update bill status to PAID
  try {
    if (payment.bill && payment.bill.status === "UNPAID") {
      // Payment has billId linked directly
      await billRepo.updateBillStatus(payment.bill.id, "PAID");
    } else if (!payment.bill && payment.room) {
      // Payment created without billId (e.g. from LIFF) — find the matching unpaid bill
      const user = await prisma.user.findUnique({ where: { lineUid: payment.user.lineUid } });
      if (user) {
        const unpaidBill = await prisma.bill.findFirst({
          where: { roomId: payment.room.id, userId: user.id, status: "UNPAID" },
          orderBy: [{ year: "desc" }, { month: "desc" }],
        });
        if (unpaidBill) {
          await billRepo.updateBillStatus(unpaidBill.id, "PAID");
          // Also link the payment to the bill for future reference
          await prisma.payment.update({ where: { id: paymentId }, data: { billId: unpaidBill.id } });
        }
      }
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

export async function getPaymentHistory(roomId, options = {}) {
  return paymentRepo.findByRoom(roomId, options);
}

export async function getPendingPayments(roomId) {
  return paymentRepo.findPendingByRoom(roomId);
}

export async function getUserPaymentHistory(lineUid) {
  return paymentRepo.findAllByLineUid(lineUid);
}
