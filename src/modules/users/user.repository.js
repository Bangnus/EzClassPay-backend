import prisma from "../../config/database.js";
import { userSelect } from "./user.model.js";

export function findAll() {
  return prisma.user.findMany({ select: userSelect });
}

export function findById(id) {
  return prisma.user.findUnique({ where: { id }, select: userSelect });
}

export function updateById(id, data) {
  return prisma.user.update({ where: { id }, data, select: userSelect });
}

export function deleteById(id) {
  return prisma.user.delete({ where: { id } });
}
