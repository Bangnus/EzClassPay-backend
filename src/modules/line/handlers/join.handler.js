import { GROUP_WELCOME, BTN_CREATE_ROOM } from "../../../constants/messages.js";

export async function handleJoin(event, lineClient) {
  const groupId = event.source.groupId;
  const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}?groupId=${groupId}`;

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: GROUP_WELCOME,
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "uri",
                label: BTN_CREATE_ROOM,
                uri: liffUrl,
              },
            },
          ],
        },
      },
    ],
  });
}
