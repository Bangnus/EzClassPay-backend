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

  // 2. สร้างห้องลงตาราง Room และเพิ่ม Manager เป็นสมาชิกลงตาราง RoomMember ทันที (Nested Write)
  return roomRepo.create({
    managerId: user.id,
    name: data.name,
    collectionType: data.collection_type,
    totalTargetAmount: data.total_target_amount || null,
    periodicAmount: data.periodic_amount || null,
    promptpayNo: data.promptpay_no,
    members: {
      create: {
        userId: user.id
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
