import prisma from "../../config/database.js";
import * as billRepo from "./bill.repository.js";
import { lineClient } from "../line/line.service.js";

export async function getBillsByRoom(roomId, options = {}) {
  return billRepo.findBillsByRoom(roomId, options);
}

export async function getBillsByUser(userId, options = {}) {
  return billRepo.findBillsByUser(userId, options);
}

export async function getBillById(id) {
  const bill = await billRepo.findBillById(id);
  if (!bill) {
    const error = new Error("Bill not found");
    error.statusCode = 404;
    throw error;
  }
  return bill;
}

export async function updateBillStatus(id, status) {
  const bill = await billRepo.findBillById(id);
  if (!bill) {
    const error = new Error("Bill not found");
    error.statusCode = 404;
    throw error;
  }
  return billRepo.updateBillStatus(id, status);
}

export async function generateMonthlyBills(month, year) {
  const rooms = await prisma.room.findMany({
    where: { collectionType: "MONTHLY" },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, lineUid: true, displayName: true },
          },
        },
      },
    },
  });

  const results = [];

  for (const room of rooms) {
    if (!room.periodicAmount || room.members.length === 0) continue;

    const amount = room.periodicAmount;
    const dueDate = new Date(year, month, 1);

    const billData = room.members.map((member) => ({
      month,
      year,
      dueDate,
      amount,
      roomId: room.id,
      userId: member.user.id,
    }));

    const created = await billRepo.createBills(billData);

    if (created.count > 0) {
      const monthName = getThaiMonthName(month);
      const dateStr = `${dueDate.getDate()}/${dueDate.getMonth() + 1}/${dueDate.getFullYear() + 543}`;

      for (const member of room.members) {
        try {
          await sendBillNotification(member.user, {
            roomId: room.id,
            roomName: room.name,
            amount,
            month: monthName,
            dueDate: dateStr,
            promptpayNo: room.promptpayNo,
          });
        } catch (e) {
          console.error(
            `Failed to notify user ${member.user.lineUid}: ${e.message}`
          );
        }
      }

      if (room.lineGroupId) {
        try {
          await sendGroupBillNotification(room, {
            amount,
            month: monthName,
            dueDate: dateStr,
            memberCount: room.members.length,
          });
        } catch (e) {
          console.error(
            `Failed to notify group ${room.lineGroupId}: ${e.message}`
          );
        }
      }

      results.push({ roomId: room.id, roomName: room.name, count: created.count });
    }
  }

  return results;
}

function getThaiMonthName(month) {
  const names = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  return names[month - 1] || "";
}

async function sendBillNotification(user, bill) {
  const flexMessage = {
    type: "flex",
    altText: `📢 บิลค่าใช้จ่ายประจำเดือน ${bill.month}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📢 แจ้งหนี้รายเดือน",
            weight: "bold",
            size: "xl",
            color: "#ea580c",
            align: "center",
          },
        ],
      },
      hero: {
        type: "box",
        layout: "vertical",
        paddingAll: "md",
        contents: [
          {
            type: "text",
            text: bill.roomName,
            weight: "bold",
            size: "xxl",
            color: "#111827",
            wrap: true,
            align: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "separator" },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "เดือน",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: bill.month,
                size: "sm",
                flex: 3,
                color: "#111827",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "ยอดที่ต้องชำระ",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: `฿${Number(bill.amount).toLocaleString()}`,
                size: "sm",
                flex: 3,
                color: "#dc2626",
                weight: "bold",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "ครบกำหนด",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: bill.dueDate,
                size: "sm",
                flex: 3,
                color: "#111827",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "พร้อมเพย์",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: bill.promptpayNo,
                size: "sm",
                flex: 3,
                color: "#111827",
                wrap: true,
              },
            ],
          },
          { type: "separator" },
          {
            type: "text",
            text: "กรุณาชำระเงินตามยอดที่แจ้งและส่งสลิปผ่าน LINE OA เพื่อยืนยันการชำระเงิน 🙏",
            size: "xs",
            color: "#9ca3af",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#ea580c",
              action: {
                type: "uri",
                label: "💸 ไปที่ LIFF เพื่อชำระเงิน",
                uri: `https://liff.line.me/${process.env.LIFF_ID_PAY_BILL}?roomId=${bill.roomId}`,
              },
          },
        ],
      },
    },
  };

  await lineClient.pushMessage({
    to: user.lineUid,
    messages: [flexMessage],
  });
}

async function sendGroupBillNotification(room, bill) {
  const groupFlex = {
    type: "flex",
    altText: `📢 แจ้งหนี้รายเดือน ${bill.month} สำหรับห้อง ${room.name}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📢 แจ้งหนี้รายเดือน",
            weight: "bold",
            size: "xl",
            color: "#ea580c",
            align: "center",
          },
        ],
      },
      hero: {
        type: "box",
        layout: "vertical",
        paddingAll: "md",
        contents: [
          {
            type: "text",
            text: room.name,
            weight: "bold",
            size: "xxl",
            color: "#111827",
            wrap: true,
            align: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "separator" },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "เดือน",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: bill.month,
                size: "sm",
                flex: 3,
                color: "#111827",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "ยอดที่ต้องชำระ",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: `฿${Number(bill.amount).toLocaleString()}`,
                size: "sm",
                flex: 3,
                color: "#dc2626",
                weight: "bold",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "ครบกำหนด",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: bill.dueDate,
                size: "sm",
                flex: 3,
                color: "#111827",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "สมาชิกทั้งหมด",
                weight: "bold",
                size: "sm",
                flex: 1,
                color: "#6b7280",
              },
              {
                type: "text",
                text: `${bill.memberCount} คน`,
                size: "sm",
                flex: 3,
                color: "#111827",
                wrap: true,
              },
            ],
          },
          { type: "separator" },
          {
            type: "text",
            text: "ระบบได้แจ้งเตือนไปยังสมาชิกทุกคนในแชทส่วนตัวแล้ว กรุณาชำระเงินตามกำหนด 🙏",
            size: "xs",
            color: "#9ca3af",
            wrap: true,
          },
        ],
      },
    },
  };

  await lineClient.pushMessage({
    to: room.lineGroupId,
    messages: [groupFlex],
  });
}
