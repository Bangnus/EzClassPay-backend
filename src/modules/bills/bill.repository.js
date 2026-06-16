import prisma from "../../config/database.js";
import { billSelect } from "./bill.model.js";

export function findBillsByRoom(roomId, options = {}) {
  const where = { roomId };
  if (options.lineUid) {
    where.user = { lineUid: options.lineUid };
  }
  return prisma.bill.findMany({
    where,
    select: billSelect,
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: options.limit || undefined,
  });
}

export function findBillsByUser(userId, options = {}) {
  return prisma.bill.findMany({
    where: { userId },
    select: billSelect,
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: options.limit || undefined,
  });
}

export function findBillsByRoomAndMonth(roomId, month, year) {
  return prisma.bill.findMany({
    where: { roomId, month, year },
    select: billSelect,
  });
}

export function findBillById(id) {
  return prisma.bill.findUnique({
    where: { id },
    select: billSelect,
  });
}

export function createBills(dataArray) {
  return prisma.bill.createMany({
    data: dataArray,
    skipDuplicates: true,
  });
}

export function updateBillStatus(id, status) {
  return prisma.bill.update({
    where: { id },
    data: { status },
    select: billSelect,
  });
}
