const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const room = await prisma.room.findFirst({
    include: {
      periods: {
        include: {
          payments: { where: { status: 'APPROVED' } }
        }
      }
    }
  });

  const allPeriods = await prisma.period.findMany({ where: { roomId: room.id } });

  console.log(`Periods from include: ${room.periods.length}`);
  console.log(`Periods from direct query: ${allPeriods.length}`);
}

main().finally(() => prisma.$disconnect());
