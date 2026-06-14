export async function handleJoin(event, lineClient) {
  const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}`;
  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{ 
      type: 'text', 
      text: `สวัสดีครับทุกคน! 🎉 ผม EzClassPay ยินดีที่ได้รู้จักครับ\n\nรบกวนตัวแทนกลุ่ม (Manager) กดลิงก์ด้านล่างนี้เพื่อ "ตั้งค่าห้องเก็บเงิน" ได้เลยครับ 👇\n\n${liffUrl}` 
    }]
  });
}
