import * as roomRepo from "./room.repository.js";
import { lineClient } from "../line/line.service.js";
import {
  ERR_USER_NOT_FOUND, ERR_DUPLICATE_ROOM, ERR_ROOM_NOT_FOUND,
  ERR_NOT_AUTHORIZED_UPDATE, ERR_NOT_AUTHORIZED_DELETE,
  ALT_ROOM_CREATED, ROOM_CREATED_HEADER,
  LABEL_CREATOR, LABEL_TYPE, LABEL_AMOUNT, LABEL_PROMPTPAY,
  COLLECTION_TARGET, COLLECTION_FIXED
} from "../../constants/messages.js";

export async function getAllRooms() {
  return roomRepo.findAll();
}

export async function getMyRooms(lineUid) {
  const user = await roomRepo.findByUserLineUid(lineUid);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const owned = user.ownedRooms || [];
  const joined = (user.joinedRooms || []).map(jr => jr.room);
  const all = [...owned, ...joined];
  const unique = all.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);
  return unique;
}

export async function getRoomByGroupId(groupId) {
  const room = await roomRepo.findByGroupId(groupId);
  if (!room) {
    const error = new Error("Room not found for this group");
    error.statusCode = 404;
    throw error;
  }
  return room;
}

export async function getRoomById(id) {
  const room = await roomRepo.findById(id);
  if (!room) {
    const error = new Error(ERR_ROOM_NOT_FOUND);
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
    const error = new Error(ERR_USER_NOT_FOUND);
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
      const error = new Error(ERR_DUPLICATE_ROOM);
      error.statusCode = 400;
      throw error;
    }
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
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Free trial: 30 days
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
    room.collectionType === "TARGET" ? COLLECTION_TARGET : COLLECTION_FIXED;
  const amountText =
    room.collectionType === "TARGET"
      ? `฿${Number(room.totalTargetAmount).toLocaleString()}`
      : `฿${Number(room.periodicAmount).toLocaleString()}/เดือน`;

  await lineClient.pushMessage({
    to: room.lineGroupId,
    messages: [
      {
        type: "flex",
        altText: ALT_ROOM_CREATED,
        contents: {
          type: "bubble",
          size: "mega",
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#00c6ae",
            paddingTop: "16px",
            paddingBottom: "16px",
            contents: [
              {
                type: "text",
                text: ROOM_CREATED_HEADER,
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
                color: "#16a085",
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
                        text: LABEL_CREATOR,
                        size: "md",
                        color: "#6b7280",
                        flex: 0,
                      },
                      {
                        type: "text",
                        text: manager.displayName,
                        size: "md",
                        color: "#111827",
                        align: "end",
                        flex: 1,
                        wrap: true,
                      },
                    ],
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: LABEL_TYPE,
                        size: "md",
                        color: "#6b7280",
                        flex: 0,
                      },
                      {
                        type: "text",
                        text: collectionTypeText,
                        size: "md",
                        color: "#111827",
                        align: "end",
                        flex: 1,
                        wrap: true,
                      },
                    ],
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: LABEL_AMOUNT,
                        size: "md",
                        color: "#6b7280",
                        flex: 0,
                      },
                      {
                        type: "text",
                        text: amountText,
                        size: "lg",
                        color: "#00c6ae",
                        weight: "bold",
                        align: "end",
                        flex: 1,
                        wrap: true,
                      },
                    ],
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: LABEL_PROMPTPAY,
                        size: "md",
                        color: "#6b7280",
                        flex: 0,
                      },
                      {
                        type: "text",
                        text: room.promptpayNo,
                        size: "md",
                        color: "#111827",
                        align: "end",
                        flex: 1,
                        wrap: true,
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
                text: "อย่าลืมเพิ่มเพื่อน LINE OA เพื่อรับการแจ้งเตือนและชำระเงินนะครับ 🙏",
                size: "xs",
                color: "#9ca3af",
                wrap: true,
                margin: "lg",
                align: "center",
              },
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
    const error = new Error(ERR_ROOM_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }
  // if (room.managerId !== managerId) {
  //   const error = new Error(ERR_NOT_AUTHORIZED_UPDATE);
  //   error.statusCode = 403;
  //   throw error;
  // }
  return roomRepo.updateById(id, data);
}

export async function deleteRoom(id, managerId) {
  const room = await roomRepo.findById(id);
  if (!room) {
    const error = new Error(ERR_ROOM_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }
  // if (room.managerId !== managerId) {
  //   const error = new Error(ERR_NOT_AUTHORIZED_DELETE);
  //   error.statusCode = 403;
  //   throw error;
  // }
  await roomRepo.deleteById(id);
}

export async function syncMembers(roomId) {
  const room = await roomRepo.findById(roomId);
  if (!room) {
    const error = new Error(ERR_ROOM_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }
  if (!room.lineGroupId) {
    const error = new Error("Room is not linked to any LINE group");
    error.statusCode = 400;
    throw error;
  }

  return {
    roomId: room.id,
    roomName: room.name,
    message: "LINE trial channel ไม่สามารถดึงรายชื่อสมาชิกเก่าได้ กรุณาให้สมาชิกส่งข้อความในกลุ่มเพื่อลงทะเบียนอัตโนมัติ",
  };
}

export async function getMembers(roomId) {
  const room = await roomRepo.findById(roomId);
  if (!room) {
    const error = new Error(ERR_ROOM_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }
  return room.members;
}

export async function removeMember(roomId, userId, managerId) {
  const room = await roomRepo.findById(roomId);
  if (!room) {
    const error = new Error(ERR_ROOM_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }
  // if (room.managerId !== managerId) {
  //   const error = new Error(ERR_NOT_AUTHORIZED_UPDATE);
  //   error.statusCode = 403;
  //   throw error;
  // }
  
  // Validate if the user to remove is the manager itself
  // if (userId === managerId) {
  //   const error = new Error("Cannot remove the manager from the room");
  //   error.statusCode = 400;
  //   throw error;
  // }

  await roomRepo.removeMember(roomId, userId);
  return { message: "Member removed successfully" };
}
