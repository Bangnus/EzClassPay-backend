import * as roomRepo from "./room.repository.js";

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
  if (data.line_group_id) {
    const existingRoom = await prisma.room.findUnique({
      where: { lineGroupId: data.line_group_id }
    });

    if (existingRoom) {
      const error = new Error("กลุ่มนี้มีการตั้งห้องกองกลางไว้แล้ว ไม่สามารถสร้างซ้ำได้ครับ");
      error.statusCode = 400; // หรือ 422
      throw error;
    }
  }

  // 3. สร้างห้องลงตาราง Room และเพิ่ม Manager เป็นสมาชิกลงตาราง RoomMember ทันที (Nested Write)
  return roomRepo.create({
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
