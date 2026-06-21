import prisma from "../src/config/database.js";

async function main() {
  const roomId = process.argv[2];

  if (!roomId) {
    console.log("❌ กรุณาระบุ ID ของห้องที่ต้องการทดสอบ");
    console.log("วิธีใช้: node scripts/test-expire-room.js <room_id>");
    process.exit(1);
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    console.log("❌ ไม่พบห้องที่มี ID นี้");
    process.exit(1);
  }

  // Set expiresAt to yesterday and lock the room
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  await prisma.room.update({
    where: { id: roomId },
    data: {
      expiresAt: yesterday,
      isPremium: true // Lock the room
    }
  });

  console.log(`✅ จำลองการหมดอายุของห้อง "${room.name}" สำเร็จ!`);
  console.log(`ตอนนี้ห้องถูกล็อคแล้ว (isPremium = true) ลองเข้า LINE แล้วกดปุ่ม "แสดงห้องทั้งหมด" เพื่อดูผลลัพธ์ครับ`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
