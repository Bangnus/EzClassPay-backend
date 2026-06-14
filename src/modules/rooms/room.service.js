import * as roomRepo from "./room.repository.js";
import { lineClient } from "../line/line.service.js";

export async function getAllRooms() {
  return roomRepo.findAll();
}

export async function getRoomById(id) {
  const room = await roomRepo.findById(id);
  if (!room) {
    const error = new Error("Room not found");
    error.statusCode = 404;
    throw error;
  }
  return room;
}

import prisma from "../../config/database.js";

export async function createRoom(data) {
  // 1. ค้นหาผู้ใช้จาก line_uid เพื่อเอา Internal ID มาใช้
  const user = await prisma.user.findUnique({
    where: { lineUid: data.line_uid }
  });

  if (!user) {
    const error = new Error("ไม่พบผู้ใช้งาน กรุณาทักแชทบอทเพื่อลงทะเบียนก่อน");
    error.statusCode = 404;
    throw error;
  }

  // 1.5 ลบการเช็ก 1 Manager = 1 ห้องออก (User 1 คนสามารถสร้างได้หลายห้อง)


  // 2. ดักเช็กก่อนว่า กลุ่มนี้มีห้องอยู่แล้วหรือยัง? (1 กลุ่ม = 1 ห้อง)
  console.log("📌 [createRoom] line_group_id ที่ได้รับ:", data.line_group_id);

  if (data.line_group_id) {
    const existingRoom = await prisma.room.findUnique({
      where: { lineGroupId: data.line_group_id }
    });

    console.log("📌 [createRoom] existingRoom ที่查询ได้:", existingRoom?.id || null);

    if (existingRoom) {
      const error = new Error("กลุ่มนี้มีการตั้งห้องกองกลางไว้แล้ว ไม่สามารถสร้างซ้ำได้ครับ");
      error.statusCode = 400;
      throw error;
    }
  } else {
    console.warn("⚠️ [createRoom] ไม่มี line_group_id — จะไม่ตรวจสอบห้องซ้ำ");
  }

  // 3. สร้างห้องลงตาราง Room และเพิ่ม Manager เป็นสมาชิกลงตาราง RoomMember ทันที (Nested Write)
  const room = await roomRepo.create({
    managerId: user.id,
    name: data.name,
    collectionType: data.collection_type,
    totalTargetAmount: data.total_target_amount || null,
    periodicAmount: data.periodic_amount || null,
    promptpayNo: data.promptpay_no,
    lineGroupId: data.line_group_id || null,
    members: {
      create: {
        userId: user.id
      }
    },
    periods: {
      create: {
        name: "งวดที่ 1 (แรกเข้า)",
        amount: data.periodic_amount || data.total_target_amount || 0
      }
    }
  });

  // 4. ส่ง Flex Message แจ้งเตือนไปยัง LINE Group
  if (room.lineGroupId) {
    try {
      await sendRoomCreatedFlex(room, user);
    } catch (e) {
      console.error("Failed to send room created Flex:", e.message);
    }
  }

  return room;
}

async function sendRoomCreatedFlex(room, manager) {
  const collectionTypeText =
    room.collectionType === "TARGET" ? "มีเป้าหมายรวม" : "ยอดคงที่ (รายเดือน)";
  const amountText =
    room.collectionType === "TARGET"
      ? `฿${Number(room.totalTargetAmount).toLocaleString()}`
      : `฿${Number(room.periodicAmount).toLocaleString()}/เดือน`;

  const liffRoomUrl = `https://liff.line.me/${process.env.LIFF_ID}`;

  await lineClient.pushMessage({
    to: room.lineGroupId,
    messages: [
      {
        type: "flex",
        altText: "✅ สร้างห้องกองกลางสำเร็จ!",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "✅ สร้างห้องกองกลางสำเร็จ!",
                weight: "bold",
                size: "xl",
                color: "#16a34a",
              },
            ],
          },
          hero: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: room.name,
                weight: "bold",
                size: "xxl",
                color: "#111827",
                wrap: true,
              },
            ],
            paddingAll: "md",
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
                    text: "ผู้สร้าง",
                    weight: "bold",
                    size: "sm",
                    flex: 1,
                    color: "#6b7280",
                  },
                  {
                    type: "text",
                    text: manager.displayName,
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
                    text: "ประเภท",
                    weight: "bold",
                    size: "sm",
                    flex: 1,
                    color: "#6b7280",
                  },
                  {
                    type: "text",
                    text: collectionTypeText,
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
                    text: "จำนวนเงิน",
                    weight: "bold",
                    size: "sm",
                    flex: 1,
                    color: "#6b7280",
                  },
                  {
                    type: "text",
                    text: amountText,
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
                    text: room.promptpayNo,
                    size: "sm",
                    flex: 3,
                    color: "#111827",
                    wrap: true,
                  },
                ],
              },
              { type: "separator" },
            ],
          },

        },
      },
    ],
  });
}

export async function updateRoom(id, data, managerId) {
  const room = await roomRepo.findById(id);
  if (!room) {
    const error = new Error("Room not found");
    error.statusCode = 404;
    throw error;
  }
  if (room.managerId !== managerId) {
    const error = new Error("Not authorized to update this room");
    error.statusCode = 403;
    throw error;
  }
  return roomRepo.updateById(id, data);
}

export async function deleteRoom(id, managerId) {
  const room = await roomRepo.findById(id);
  if (!room) {
    const error = new Error("Room not found");
    error.statusCode = 404;
    throw error;
  }
  if (room.managerId !== managerId) {
    const error = new Error("Not authorized to delete this room");
    error.statusCode = 403;
    throw error;
  }
  await roomRepo.deleteById(id);
}
