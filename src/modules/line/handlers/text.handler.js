import prisma from "../../../config/database.js";

export async function handleText(event, lineClient) {
  const text = event.message.text;
  const userId = event.source.userId;

  if (text === 'แจ้งโอนเงิน' || text === 'จ่ายเงิน') {
    // ดึงงวดทั้งหมด (ในระบบจริงควรกรองเฉพาะห้องที่ User อยู่)
    const periods = await prisma.period.findMany({
      include: {
        room: true,
        payments: {
          where: { lineUid: userId },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      take: 5 // แสดงแค่ 5 งวดล่าสุด
    });

    if (periods.length === 0) {
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'ยังไม่มีรายการงวดที่ต้องจ่ายในขณะนี้ครับ 🎉' }]
      });
    }

    // สร้าง Flex Message แบบ Bubble List
    const flexBubbles = periods.map(p => {
      const lastPayment = p.payments[0];
      let statusText = "ค้างชำระ";
      let statusColor = "#ff334b";
      let buttonAction = {
        type: "postback",
        label: "💸 กดเพื่อจ่ายงวดนี้",
        data: `action=pay&period_id=${p.id}`,
        displayText: `กำลังจ่าย ${p.name}`
      };

      if (lastPayment) {
        if (lastPayment.status === 'APPROVED') {
          statusText = "จ่ายแล้ว ✅";
          statusColor = "#00c300";
          buttonAction = { type: "message", label: "ดูใบเสร็จ", text: "ยังไม่รองรับ" };
        } else if (lastPayment.status === 'PENDING') {
          statusText = "รอตรวจสอบ ⏳";
          statusColor = "#ffb81c";
          buttonAction = { type: "message", label: "กำลังรอแอดมินตรวจ", text: "แอดมินกำลังตรวจสลิปครับ" };
        }
      }

      return {
        type: "bubble",
        body: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            { type: "text", text: p.room.name, weight: "bold", size: "sm", color: "#aaaaaa" },
            { type: "text", text: p.name, weight: "bold", size: "xl", wrap: true },
            {
              type: "box", layout: "baseline",
              contents: [
                { type: "text", text: "ยอดที่ต้องจ่าย", color: "#aaaaaa", size: "sm", flex: 1 },
                { type: "text", text: `฿${p.amount}`, wrap: true, color: "#666666", size: "sm", flex: 1, align: "end" }
              ]
            },
            {
              type: "box", layout: "baseline",
              contents: [
                { type: "text", text: "สถานะ", color: "#aaaaaa", size: "sm", flex: 1 },
                { type: "text", text: statusText, wrap: true, color: statusColor, size: "sm", flex: 1, align: "end", weight: "bold" }
              ]
            }
          ]
        },
        footer: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            {
              type: "button",
              style: lastPayment && lastPayment.status !== 'REJECTED' ? "secondary" : "primary",
              height: "sm",
              action: buttonAction
            }
          ]
        }
      };
    });

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: "flex",
        altText: "รายการงวดที่ต้องชำระเงิน",
        contents: { type: "carousel", contents: flexBubbles }
      }]
    });
  }
}
