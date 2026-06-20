import prisma from "../../config/database.js";
import { roomSelect } from "./room.model.js";

export function findAll(filters = {}) {
  return prisma.room.findMany({ where: filters, select: roomSelect });
}

export function findById(id) {
  return prisma.room.findUnique({ where: { id }, select: roomSelect });
}

export function create(data) {
  return prisma.room.create({ data, select: roomSelect });
}

export function updateById(id, data) {
  return prisma.room.update({ where: { id }, data, select: roomSelect });
}

export function deleteById(id) {
  return prisma.room.delete({ where: { id } });
}

export function findByGroupId(groupId) {
  return prisma.room.findUnique({ where: { lineGroupId: groupId }, select: roomSelect });
}

export function findByUserLineUid(lineUid) {
  return prisma.user.findUnique({
    where: { lineUid },
    include: {
      ownedRooms: { select: roomSelect },
      joinedRooms: {
        include: {
          room: { select: roomSelect }
        }
      }
    }
  });
}

export function removeMember(roomId, userId) {
  return prisma.roomMember.delete({
    where: {
      roomId_userId: {
        roomId,
        userId
      }
    }
  });
}
