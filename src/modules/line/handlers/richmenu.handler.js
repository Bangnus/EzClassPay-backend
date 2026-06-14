import prisma from "../../../config/database.js";
import { RICH_MENU } from "../../../constants/richmenu.js";
import {
  ROOM_SWITCH_BACK, ROOM_NOT_FOUND, NO_ROOMS,
  welcomeManager, welcomeMember,
  LABEL_PROMPTPAY, LABEL_ROLE_MANAGER, LABEL_ROLE_MEMBER,
  BTN_SELECT_ROOM, ALT_ROOM_LIST, displaySelectingRoom
} from "../../../constants/messages.js";

export async function handleSwitchRoom(event, lineClient) {
  const userId = event.source.userId;
  await lineClient.linkRichMenuIdToUser(userId, RICH_MENU.SELECT);

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: ROOM_SWITCH_BACK
    }]
  });
}

export async function handleSelectRoom(event, lineClient) {
  const userId = event.source.userId;
  const data = new URLSearchParams(event.postback.data);
  const roomId = data.get('room_id');

  const room = await prisma.room.findUnique({
    where: { id: roomId }
  });

  if (!room) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: ROOM_NOT_FOUND }]
    });
  }

  const user = await prisma.user.findUnique({ where: { lineUid: userId } });
  if (!user) return;

  const isManager = room.managerId === user.id;

  if (isManager) {
    await lineClient.linkRichMenuIdToUser(userId, RICH_MENU.MANAGER);
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: welcomeManager(room.name)
      }]
    });
  }

  await lineClient.linkRichMenuIdToUser(userId, RICH_MENU.MEMBER);
  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: welcomeMember(room.name)
    }]
  });
}

export async function handleShowRooms(event, lineClient) {
  const userId = event.source.userId;

  const user = await prisma.user.findUnique({
    where: { lineUid: userId },
    include: {
      ownedRooms: true,
      joinedRooms: { include: { room: true } }
    }
  });

  if (!user) return;

  const ownedIds = new Set(user.ownedRooms.map(r => r.id));
  const joinedIds = new Set(user.joinedRooms.map(jr => jr.roomId));

  const allRooms = [
    ...user.ownedRooms,
    ...user.joinedRooms.map(jr => jr.room)
  ];

  const uniqueRooms = allRooms.filter((r, i, arr) =>
    arr.findIndex(x => x.id === r.id) === i
  );

  if (uniqueRooms.length === 0) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: NO_ROOMS
      }]
    });
  }

  const bubbles = uniqueRooms.map(room => {
    const isManager = ownedIds.has(room.id);
    const roleText = isManager ? LABEL_ROLE_MANAGER : LABEL_ROLE_MEMBER;
    const roleBadgeColor = isManager ? '#FFF3E0' : '#E8F5E9';
    const roleTextColor = isManager ? '#E65100' : '#2E7D32';

    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: room.name,
                weight: 'bold',
                size: 'lg',
                wrap: true,
                flex: 1
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [{
                  type: 'text',
                  text: roleText,
                  size: 'xs',
                  color: roleTextColor,
                  weight: 'bold',
                  align: 'center'
                }],
                backgroundColor: roleBadgeColor,
                cornerRadius: '8px',
                paddingAll: '3px',
                paddingStart: '7px',
                paddingEnd: '7px',
                alignItems: 'center',
                justifyContent: 'center'
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              { type: 'text', text: LABEL_PROMPTPAY, color: '#8c8c8c', size: 'sm', flex: 1 },
              { type: 'text', text: room.promptpayNo, color: '#333333', size: 'sm', flex: 1, align: 'end' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [{
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: {
            type: 'postback',
            label: BTN_SELECT_ROOM,
            data: `action=select_room&room_id=${room.id}`,
            displayText: displaySelectingRoom(room.name)
          }
        }]
      }
    };
  });

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: ALT_ROOM_LIST,
      contents: { type: 'carousel', contents: bubbles }
    }]
  });
}
