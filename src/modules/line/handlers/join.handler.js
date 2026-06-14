const LIFF_CREATE_ROOM = `https://liff.line.me/${process.env.LIFF_ID}`;
const BOT_LINE_URL = `https://line.me/R/ti/p/${process.env.LINE_BOT_ID}`;

export async function handleJoin(event, lineClient) {
  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: "สวัสดีครับกลุ่มใหม่! 👋 ผมบอท EzClassPay\nพร้อมช่วยคุณจัดการเงินกองกลางแล้วครับ",
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "uri",
                label: "👑 สร้างห้องกองกลาง",
                uri: LIFF_CREATE_ROOM,
              },
            },
          ],
        },
      },
    ],
  });
}
