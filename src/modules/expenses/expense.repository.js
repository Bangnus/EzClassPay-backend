import prisma from "../../config/database.js";
import { expenseSelect } from "./expense.model.js";

export function create(data) {
  return prisma.expense.create({ data, select: expenseSelect });
}

export function findById(id) {
  return prisma.expense.findUnique({ where: { id }, select: expenseSelect });
}

export function findByRoomId(roomId) {
  return prisma.expense.findMany({ where: { roomId }, select: expenseSelect, orderBy: { createdAt: "desc" } });
}
