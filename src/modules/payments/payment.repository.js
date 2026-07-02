import prisma from "../../config/database.js";

export function findRoomById(roomId) {
  return prisma.room.findUnique({ where: { id: roomId }, select: { id: true, name: true } });
}

export function findPendingByLineUid(lineUid) {
  return prisma.payment.findFirst({
    where: { lineUid, status: "AWAITING_SLIP" },
    orderBy: { createdAt: "desc" },
    include: { room: true },
  });
}

export function createPayment(data) {
  return prisma.payment.create({ data });
}

export function findById(id) {
  return prisma.payment.findUnique({
    where: { id },
    include: {
      bill: { select: { id: true, month: true, year: true, status: true } },
      room: { select: { id: true, name: true, lineGroupId: true, promptpayNo: true } },
      user: { select: { id: true, displayName: true, lineUid: true, pictureUrl: true } },
    },
  });
}

export function findByRoom(roomId, options = {}) {
  const where = { roomId };
  if (options.userId) {
    where.user = { id: options.userId };
  }
  if (options.lineUid) {
    where.lineUid = options.lineUid;
  }
  
  return prisma.payment.findMany({
    where,
    include: {
      user: { select: { id: true, displayName: true, lineUid: true, pictureUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findPendingByRoom(roomId) {
  return prisma.payment.findMany({
    where: { roomId, status: "PENDING" },
    include: {
      user: { select: { id: true, displayName: true, lineUid: true, pictureUrl: true } },
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

export async function findAllByLineUid(lineUid, options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where: { lineUid },
      include: {
        room: { select: { id: true, name: true, lineGroupId: true } },
        user: { select: { id: true, displayName: true, lineUid: true, pictureUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { lineUid } })
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}
