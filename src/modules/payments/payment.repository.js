import prisma from "../../config/database.js";

export function findRoomById(roomId) {
  return prisma.room.findUnique({ where: { id: roomId }, select: { id: true, name: true } });
}

export function findPendingByLineUid(lineUid) {
  return prisma.payment.findFirst({
    where: { lineUid, status: "AWAITING_SLIP" },
    orderBy: { createdAt: "desc" },
    include: { period: true, room: true },
  });
}

export function createPayment(data) {
  return prisma.payment.create({ data });
}

export function findById(id) {
  return prisma.payment.findUnique({
    where: { id },
    include: {
      period: true,
      room: { select: { id: true, name: true, lineGroupId: true, promptpayNo: true } },
      user: { select: { id: true, displayName: true, lineUid: true } },
    },
  });
}

export function findByRoom(roomId, options = {}) {
  const where = { roomId };
  if (options.userId) {
    where.user = { id: options.userId };
  }
  
  return prisma.payment.findMany({
    where,
    include: {
      period: true,
      user: { select: { id: true, displayName: true, lineUid: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findPendingByRoom(roomId) {
  return prisma.payment.findMany({
    where: { roomId, status: "PENDING" },
    include: {
      user: { select: { id: true, displayName: true, lineUid: true } },
      room: { select: { name: true, lineGroupId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function updateStatus(id, status) {
  return prisma.payment.update({
    where: { id },
    data: { status },
  });
}
