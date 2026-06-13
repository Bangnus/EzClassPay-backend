import * as line from "@line/bot-sdk";
import prisma from "../../config/database.js";

export const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

export async function handleEvent(event) {
  // เช็กว่ามาจากแชทประเภทไหน ('user', 'group', หรือ 'room')
  const chatType = event.source.type;

  // ==========================================
  // 🟢 กรณีที่ 1: แชทส่วนตัว (1-on-1)
  // ==========================================
  if (chatType === 'user') {
    const userId = event.source.userId;
    
    if (event.type === 'message' && event.message.type === 'text') {
      try {
        // ดึงข้อมูลโปรไฟล์เพื่อเซฟลง DB
        const profile = await lineClient.getProfile(userId);
        
        await prisma.user.upsert({
          where: { lineUid: profile.userId },
          update: {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
          },
          create: {
            lineUid: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
          }
        });

        console.log(`✅ บันทึกผู้ใช้: ${profile.displayName} ลง Database เรียบร้อยแล้ว`);

        // โลจิกสำหรับ: ลงทะเบียน, Manager กดปุ่มสร้างห้อง, หรือลูกบ้านส่งสลิปจ่ายเงิน
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: 'นี่คือแชทส่วนตัว ไว้สำหรับจัดการเงินของคุณครับ 💸' }]
        });
      } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลหรือบันทึกลง DB:', error);
      }
    }
  }
  // ==========================================
  // 🔵 กรณีที่ 2: แชทกลุ่ม (Group)
  // ==========================================
  else if (chatType === 'group') {
    const groupId = event.source.groupId; // รหัสของกลุ่ม (เอาไว้ใช้เวลาจะส่งบรอดแคสต์เข้ากลุ่มนี้)
    
    // จังหวะที่ 2.1: มีคนเชิญบอทเข้ากลุ่มปุ๊บ (Event type = join)
    if (event.type === 'join') {
      const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}`;

      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ 
          type: 'text', 
          text: `สวัสดีครับทุกคน! 🎉 ผม EzClassPay ยินดีที่ได้รู้จักครับ\n\nรบกวนตัวแทนหรือคนดูแลเงินประจำกลุ่ม (Manager) กดลิงก์ด้านล่างนี้เพื่อ "ตั้งค่าห้องเก็บเงิน" ได้เลยครับ 👇\n\n${liffUrl}` 
        }]
      });
    }

    // จังหวะที่ 2.2: มีคนพิมพ์ข้อความในกลุ่ม
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text;
      
      // ดักคีย์เวิร์ดเฉพาะในกลุ่ม เช่น พิมพ์คำว่า "สรุปยอด"
      if (text === 'สรุปยอด') {
         return lineClient.replyMessage({
           replyToken: event.replyToken,
           messages: [{ type: 'text', text: '📊 สรุปยอดตอนนี้: จ่ายแล้ว 5 คน, ค้างจ่าย 2 คน' }]
         });
      }
      // ถ้าพิมพ์อย่างอื่น บอทจะเงียบ (ไม่กวนบทสนทนาคนในกลุ่ม)
    }
  }

  return Promise.resolve(null);
}
