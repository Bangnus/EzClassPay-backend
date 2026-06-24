import prisma from "../../config/database.js";
import { generateToken } from "../../utils/generateToken.js";
import { lineClient } from "../line/line.service.js";
import { RICH_MENU } from "../../constants/richmenu.js";
import * as authRepo from "./auth.repository.js";

export async function loginWithLine({ lineUid, displayName, pictureUrl }) {
  const user = await authRepo.upsertByLineUid(lineUid, { displayName, pictureUrl });

  const token = generateToken({ userId: user.id });

  return {
    token,
    user: {
      id: user.id,
      lineUid: user.lineUid,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
      role: user.role,
    },
  };
}

export async function syncUser({ line_uid, name, profile_url, action }) {
  const user = await authRepo.upsertByLineUid(line_uid, { displayName: name, pictureUrl: profile_url });

  if (user.activeRoomId) {
    const room = await prisma.room.findUnique({ where: { id: user.activeRoomId } });
    if (room) {
      const menu = room.managerId === user.id ? RICH_MENU.MANAGER : RICH_MENU.MEMBER;
      await lineClient.linkRichMenuIdToUser(line_uid, menu);
      return {
        id: user.id,
        lineUid: user.lineUid,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
        role: user.role,
        activeRoomId: user.activeRoomId,
      };
    }
  }

  if (action === "create_room") {
    await lineClient.linkRichMenuIdToUser(line_uid, RICH_MENU.MANAGER);
  } else if (action === "pay_bill") {
    await lineClient.linkRichMenuIdToUser(line_uid, RICH_MENU.MEMBER);
  }

  return {
    id: user.id,
    lineUid: user.lineUid,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    role: user.role,
    activeRoomId: user.activeRoomId,
  };
}

export async function getProfile(userId) {
  const user = await authRepo.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  return {
    id: user.id,
    lineUid: user.lineUid,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    role: user.role,
    createdAt: user.createdAt,
  };
}
