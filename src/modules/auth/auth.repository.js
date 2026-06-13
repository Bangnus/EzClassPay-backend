import prisma from "../../config/database.js";

export function findByLineUid(lineUid) {
  return prisma.user.findUnique({ where: { lineUid } });
}

export function upsertByLineUid(lineUid, data) {
  return prisma.user.upsert({
    where: { lineUid },
    update: {
      displayName: data.displayName,
      pictureUrl: data.pictureUrl ?? null,
    },
    create: {
      lineUid,
      displayName: data.displayName,
      pictureUrl: data.pictureUrl ?? null,
    },
  });
}

export function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}
