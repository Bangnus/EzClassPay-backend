const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    include: {
      bills: true,
      payments: true
    }
  });
  console.log(rooms.map(r => ({ id: r.id, name: r.name, bills: r.bills.length, payments: r.payments.length })));
}

main().finally(() => prisma.$disconnect());
