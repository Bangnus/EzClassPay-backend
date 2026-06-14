import fs from 'fs';
import * as line from '@line/bot-sdk';
import 'dotenv/config'; // เพื่อให้มันอ่านค่าจากไฟล์ .env ได้ตอนรันเดี่ยวๆ

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

// สำหรับอัปโหลดไฟล์ (ใน SDK เวอร์ชั่นใหม่จะแยก Client สำหรับจัดการไฟล์)
const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

async function setupRichMenu() {
  try {
    console.log("🚀 กำลังสร้าง Rich Menu...");

    // 1. กำหนดโครงสร้างและปุ่มของ Rich Menu
    const richMenuObject = {
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "Main Menu",
      chatBarText: "เมนูหลัก",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 1686 },
          action: { type: "message", text: "แจ้งโอนเงิน" } // ซีกซ้าย
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
          action: { type: "message", text: "ดูยอดค้างจ่าย" } // ซีกขวา
        }
      ]
    };

    // 2. ยิง API ไปสร้าง Rich Menu โครงเปล่า
    const response = await lineClient.createRichMenu(richMenuObject);
    const richMenuId = response.richMenuId;
    console.log("✅ สร้างโครง Rich Menu สำเร็จ! ได้ ID:", richMenuId);

    // 3. เตรียมอัปโหลดรูปภาพ
    // *** สำคัญ: สร้างโฟลเดอร์ assets แล้วเอารูปขนาด 2500x1686 ชื่อ richmenu.png ไปใส่ไว้ ***
    const imagePath = './assets/richmenu.png'; 
    
    if (fs.existsSync(imagePath)) {
      console.log(`📤 กำลังอัปโหลดรูปภาพจาก ${imagePath}...`);
      
      const imageBuffer = fs.readFileSync(imagePath);
      // แปลง Buffer เป็น Blob (สำหรับ SDK ตัวใหม่)
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      
      await blobClient.setRichMenuImage(richMenuId, blob);
      console.log("✅ อัปโหลดรูปภาพเข้า Rich Menu สำเร็จ!");

      // 4. (Optional) ผูกเมนูนี้ให้เป็นค่าเริ่มต้นของทุกคน
      await lineClient.setDefaultRichMenu(richMenuId);
      console.log("✅ ผูกเป็นเมนูหลัก Default ให้ทุกคนเรียบร้อย!");

      console.log(`\n🎉 เสร็จสิ้น! จด ID นี้เก็บไว้ใช้ได้เลย: ${richMenuId}\n`);
    } else {
      console.log(`\n⚠️ แจ้งเตือน: ไม่พบไฟล์รูปภาพที่ ${imagePath}\nระบบสร้างโครงเมนูเสร็จแล้ว แต่ยังไม่มีภาพ รบกวนเอารูปไปวางตามพาร์ทแล้วรันใหม่อีกครั้งครับ`);
    }

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
  }
}

setupRichMenu();
