const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    include: {
      periods: true,
      bills: true
    }
  });
  console.log(rooms.map(r => ({ id: r.id, name: r.name, periods: r.periods.length, bills: r.bills.length })));
}

main().finally(() => prisma.$disconnect());
