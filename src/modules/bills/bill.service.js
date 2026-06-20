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

  return results;
}

export async function generateBillsForRoom(roomId, month, year) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
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

  if (!room || !room.periodicAmount || room.members.length === 0) {
    const error = new Error("Room not found or cannot generate bills");
    error.statusCode = 400;
    throw error;
  }

  const amount = room.periodicAmount;
  const dueDate = new Date(year, month, 1);

  // Fetch existing bills for this month
  const existingBills = await billRepo.findBillsByRoomAndMonth(roomId, month, year);
  const existingUserIds = existingBills.map(b => b.userId);

  // Create bills only for members who don't have one
  const missingMembers = room.members.filter(m => !existingUserIds.includes(m.user.id));
  let newBillsCount = 0;

  if (missingMembers.length > 0) {
    const billData = missingMembers.map((member) => ({
      month,
      year,
      dueDate,
      amount,
      roomId: room.id,
      userId: member.user.id,
    }));
    const created = await billRepo.createBills(billData);
    newBillsCount = created.count;
  }

  // Refetch all bills for this month to include the newly created ones
  const allBillsThisMonth = await billRepo.findBillsByRoomAndMonth(roomId, month, year);

  const monthName = getThaiMonthName(month);
  const dateStr = `${dueDate.getDate()}/${dueDate.getMonth() + 1}/${dueDate.getFullYear() + 543}`;

  let notifiedCount = 0;

  for (const member of room.members) {
    // Check if this member has an UNPAID or OVERDUE bill
    const memberBill = allBillsThisMonth.find(b => b.userId === member.user.id);
    if (memberBill && (memberBill.status === "UNPAID" || memberBill.status === "OVERDUE")) {
      try {
        await sendBillNotification(member.user, {
          roomId: room.id,
          roomName: room.name,
          amount,
          month: monthName,
          dueDate: dateStr,
          promptpayNo: room.promptpayNo,
        });
        notifiedCount++;
      } catch (e) {
        console.error(
          `Failed to notify user ${member.user.lineUid}: ${e.message}`
        );
      }
    }
  }

  if (room.lineGroupId && notifiedCount > 0) {
    try {
      await sendGroupBillNotification(room, {
        amount,
        month: monthName,
        dueDate: dateStr,
        memberCount: notifiedCount, // Notify group about the number of unpaid members
      });
    } catch (e) {
      console.error(
        `Failed to notify group ${room.lineGroupId}: ${e.message}`
      );
    }
  }

  return { roomId: room.id, roomName: room.name, newBillsCreated: newBillsCount, membersNotified: notifiedCount };
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
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#ea580c",
        paddingTop: "16px",
        paddingBottom: "16px",
        contents: [
          {
            type: "text",
            text: "📢 แจ้งยอดชำระประจำเดือน",
            weight: "bold",
            size: "lg",
            color: "#ffffff",
            align: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        contents: [
          {
            type: "text",
            text: bill.roomName,
            weight: "bold",
            size: "xl",
            color: "#111827",
            wrap: true,
            align: "center",
          },
          {
            type: "separator",
            margin: "xl",
            color: "#e5e7eb",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xl",
            spacing: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "รอบเดือน",
                    size: "md",
                    color: "#6b7280",
                    flex: 0,
                  },
                  {
                    type: "text",
                    text: bill.month,
                    size: "md",
                    color: "#111827",
                    weight: "bold",
                    align: "end",
                    flex: 1,
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "ยอดที่ต้องจ่าย",
                    size: "md",
                    color: "#6b7280",
                    flex: 0,
                  },
                  {
                    type: "text",
                    text: `฿${Number(bill.amount).toLocaleString()}`,
                    size: "lg",
                    color: "#dc2626",
                    weight: "bold",
                    align: "end",
                    flex: 1,
                  },
                ],
              },
            ],
          },
          {
            type: "separator",
            margin: "xl",
            color: "#e5e7eb",
          },
          {
            type: "text",
            text: "กรุณาชำระเงินตามยอดที่แจ้งและส่งสลิปผ่าน LINE OA เพื่อยืนยันการชำระเงิน 🙏",
            size: "xs",
            color: "#9ca3af",
            wrap: true,
            margin: "lg",
            align: "center",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "lg",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#ea580c",
            action: {
              type: "uri",
              label: "ชำระเงิน",
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
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#ea580c",
        paddingTop: "16px",
        paddingBottom: "16px",
        contents: [
          {
            type: "text",
            text: "📢 แจ้งยอดชำระประจำเดือน",
            weight: "bold",
            size: "lg",
            color: "#ffffff",
            align: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "xl",
        contents: [
          {
            type: "text",
            text: room.name,
            weight: "bold",
            size: "xl",
            color: "#111827",
            wrap: true,
            align: "center",
          },
          {
            type: "separator",
            margin: "xl",
            color: "#e5e7eb",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xl",
            spacing: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "รอบเดือน",
                    size: "md",
                    color: "#6b7280",
                    flex: 0,
                  },
                  {
                    type: "text",
                    text: bill.month,
                    size: "md",
                    color: "#111827",
                    weight: "bold",
                    align: "end",
                    flex: 1,
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "ยอดที่ต้องจ่าย",
                    size: "md",
                    color: "#6b7280",
                    flex: 0,
                  },
                  {
                    type: "text",
                    text: `฿${Number(bill.amount).toLocaleString()}`,
                    size: "lg",
                    color: "#dc2626",
                    weight: "bold",
                    align: "end",
                    flex: 1,
                  },
                ],
              },
            ],
          },
          {
            type: "separator",
            margin: "xl",
            color: "#e5e7eb",
          },
          {
            type: "text",
            text: "ระบบได้แจ้งเตือนไปยังสมาชิกทุกคนในแชทส่วนตัวแล้ว กรุณาชำระเงินตามกำหนด 🙏",
            size: "xs",
            color: "#9ca3af",
            wrap: true,
            margin: "lg",
            align: "center",
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
