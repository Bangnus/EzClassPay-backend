import prisma from "../../../config/database.js";
import { RICH_MENU } from "../../../constants/richmenu.js";
import {
  ROOM_SWITCH_BACK, ROOM_NOT_FOUND, NO_ROOMS, ROOM_LEFT,
  welcomeManager, welcomeMember,
  LABEL_PROMPTPAY, LABEL_ROLE_MANAGER, LABEL_ROLE_MEMBER,
  BTN_SELECT_ROOM, ALT_ROOM_LIST, displaySelectingRoom
} from "../../../constants/messages.js";

export async function handleSwitchRoom(event, lineClient) {
  const userId = event.source.userId;
  const user = await prisma.user.findUnique({ where: { lineUid: userId } });
  if (!user) return;

  if (user.activeRoomId) {
    await prisma.user.update({
      where: { lineUid: userId },
      data: { activeRoomId: null }
    });
  }

  await lineClient.linkRichMenuIdToUser(userId, RICH_MENU.SELECT);

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: user.activeRoomId ? ROOM_LEFT : ROOM_SWITCH_BACK
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

  await prisma.user.update({
    where: { lineUid: userId },
    data: { activeRoomId: roomId }
  });

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

export async function handleLeaveRoom(event, lineClient) {
  const userId = event.source.userId;

  await prisma.user.update({
    where: { lineUid: userId },
    data: { activeRoomId: null }
  });

  await lineClient.linkRichMenuIdToUser(userId, RICH_MENU.SELECT);

  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: ROOM_LEFT
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
    
    // Premium locked logic
    const isLocked = room.isPremium === true;

    // Use theme colors
    const roleBadgeColor = isManager ? '#00c6ae' : '#e5e7eb';
    const roleTextColor = isManager ? '#ffffff' : '#4b5563';

    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '0px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'xl',
            backgroundColor: isLocked ? '#f3f4f6' : '#f0fffc',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                contents: [
                  {
                    type: 'text',
                    text: isLocked ? '🔒' : '🏠',
                    size: 'xl',
                    flex: 0
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    contents: [{
                      type: 'text',
                      text: roleText,
                      size: 'xs',
                      color: isLocked ? '#9ca3af' : roleTextColor,
                      weight: 'bold',
                      align: 'center'
                    }],
                    backgroundColor: isLocked ? '#e5e7eb' : roleBadgeColor,
                    cornerRadius: '100px',
                    paddingStart: '8px',
                    paddingEnd: '8px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    flex: 0
                  }
                ]
              },
              {
                type: 'text',
                text: room.name,
                weight: 'bold',
                size: 'xl',
                color: isLocked ? '#9ca3af' : '#16a085',
                wrap: true,
                margin: 'lg'
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: [{
          type: 'button',
          style: 'primary',
          color: isLocked ? '#ef4444' : '#00c6ae',
          height: 'sm',
          action: isLocked
            ? {
              type: 'postback',
              label: '💳 ชำระเงินเพื่อปลดล็อค',
              data: `action=subscribe&room_id=${room.id}`,
            }
            : {
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
