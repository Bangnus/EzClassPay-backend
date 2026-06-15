import fs from 'fs';
import * as line from '@line/bot-sdk';
import 'dotenv/config';

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN
});

async function setupRichMenus() {
  try {
    console.log("🚀 กำลังสร้าง Rich Menu ทั้ง 3 ตัว...\n");

    // 1. RICH_MENU_SELECT — หน้าแรก เลือกห้อง
    const selectMenu = await lineClient.createRichMenu({
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "Menu Select",
      chatBarText: "เลือกห้อง",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 833, height: 1686 },
          action: { type: "message", text: "แสดงห้องทั้งหมด" }
        },
        {
          bounds: { x: 833, y: 0, width: 833, height: 1686 },
          action: { type: "uri", uri: `https://liff.line.me/${process.env.LIFF_ID}/history` }
        },
        {
          bounds: { x: 1666, y: 0, width: 834, height: 1686 },
          action: { type: "message", text: "คู่มือการใช้งาน" }
        }
      ]
    });
    const SELECT_MENU_ID = selectMenu.richMenuId;
    console.log("✅ RichMenu SELECT ID:", SELECT_MENU_ID);

    const selectImagePath = './assets/richmenu-select.png';
    if (fs.existsSync(selectImagePath)) {
      await blobClient.setRichMenuImage(SELECT_MENU_ID, new Blob([fs.readFileSync(selectImagePath)], { type: 'image/png' }));
      console.log("   รูป SELECT อัปโหลดแล้ว");
    } else {
      console.log("   ⚠️ ไม่พบรูป richmenu-select.png ข้ามการอัปโหลดรูป");
    }

    // 2. RICH_MENU_MEMBER — หน้าลูกบ้าน
    const memberMenu = await lineClient.createRichMenu({
      size: { width: 2500, height: 1686 },
      selected: false,
      name: "Menu Member",
      chatBarText: "เมนูสมาชิก",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 843 },
          action: { type: "postback", data: "action=pay" }
        },
        {
          bounds: { x: 0, y: 843, width: 1250, height: 843 },
          action: { type: "uri", uri: `https://liff.line.me/${process.env.LIFF_ID}/member-history` }
        },
        {
          bounds: { x: 1250, y: 843, width: 1250, height: 843 },
          action: { type: "postback", data: "action=switch_room" }
        }
      ]
    });
    const MEMBER_MENU_ID = memberMenu.richMenuId;
    console.log("✅ RichMenu MEMBER ID:", MEMBER_MENU_ID);

    const memberImagePath = './assets/richmenu-member.png';
    if (fs.existsSync(memberImagePath)) {
      await blobClient.setRichMenuImage(MEMBER_MENU_ID, new Blob([fs.readFileSync(memberImagePath)], { type: 'image/png' }));
      console.log("   รูป MEMBER อัปโหลดแล้ว");
    } else {
      console.log("   ⚠️ ไม่พบรูป richmenu-member.png ข้ามการอัปโหลดรูป");
    }

    // 3. RICH_MENU_MANAGER — หน้าแอดมิน
    const managerMenu = await lineClient.createRichMenu({
      size: { width: 2500, height: 1686 },
      selected: false,
      name: "Menu Manager",
      chatBarText: "เมนูผู้ดูแล",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 843 },
          action: { type: "postback", data: "action=pay" }
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 843 },
          action: { type: "uri", uri: `https://liff.line.me/${process.env.LIFF_ID}/verify-slip` }
        },
        {
          bounds: { x: 0, y: 843, width: 1250, height: 843 },
          action: { type: "uri", uri: `https://liff.line.me/${process.env.LIFF_ID}/dashboard` }
        },
        {
          bounds: { x: 1250, y: 843, width: 1250, height: 843 },
          action: { type: "postback", data: "action=switch_room" }
        }
      ]
    });
    const MANAGER_MENU_ID = managerMenu.richMenuId;
    console.log("✅ RichMenu MANAGER ID:", MANAGER_MENU_ID);

    const managerImagePath = './assets/richmenu-manager.png';
    if (fs.existsSync(managerImagePath)) {
      await blobClient.setRichMenuImage(MANAGER_MENU_ID, new Blob([fs.readFileSync(managerImagePath)], { type: 'image/png' }));
      console.log("   รูป MANAGER อัปโหลดแล้ว");
    } else {
      console.log("   ⚠️ ไม่พบรูป richmenu-manager.png ข้ามการอัปโหลดรูป");
    }

    // 4. ตั้ง SELECT เป็นค่าเริ่มต้น
    await lineClient.setDefaultRichMenu(SELECT_MENU_ID);
    console.log("\n🎉 ตั้ง SELECT เป็นเมนูเริ่มต้นเรียบร้อย!");

    console.log(`\n📋 คัดลอก ID เหล่านี้ไปใส่ใน src/constants/richmenu.js:\n`);
    console.log(`SELECT_MENU_ID  = '${SELECT_MENU_ID}'`);
    console.log(`MEMBER_MENU_ID  = '${MEMBER_MENU_ID}'`);
    console.log(`MANAGER_MENU_ID = '${MANAGER_MENU_ID}'`);

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
  }
}

setupRichMenus();
