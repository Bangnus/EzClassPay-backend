import cron from "node-cron";
import prisma from "../config/database.js";
import { lineClient } from "../modules/line/line.service.js";
import { logger } from "../utils/logger.js";

export function startSubscriptionCron() {
  // Run daily at 00:00
  cron.schedule("0 0 * * *", async () => {
    logger.info("[SubscriptionCron] Running daily subscription check...");

    const now = new Date();

    try {
      await warnExpiringRooms(now);
      await lockExpiredRooms(now);
    } catch (err) {
      logger.error(`[SubscriptionCron] Failed: ${err.message}`);
    }
  });

  logger.info("[SubscriptionCron] Scheduled — runs daily at 00:00");
}

// ─── Warn rooms expiring in 3 days ──────────────────────────────
async function warnExpiringRooms(now) {
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Rooms that expire between 1-3 days from now and are NOT yet locked
  const rooms = await prisma.room.findMany({
    where: {
      isPremium: false,
      expiresAt: {
        gte: oneDayFromNow,
        lte: threeDaysFromNow,
      },
    },
    include: {
      manager: true,
    },
  });

  for (const room of rooms) {
    if (!room.manager) continue;

    const daysLeft = Math.ceil((room.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const expiryStr = room.expiresAt.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    try {
      await lineClient.pushMessage({
        to: room.manager.lineUid,
        messages: [
          {
            type: "flex",
            altText: `⚠️ ห้อง "${room.name}" จะหมดอายุใน ${daysLeft} วัน`,
            contents: {
              type: "bubble",
              size: "kilo",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#f59e0b",
                paddingAll: "lg",
                contents: [
                  {
                    type: "text",
                    text: "⚠️ ห้องกำลังจะหมดอายุ",
                    weight: "bold",
                    size: "lg",
                    color: "#ffffff",
                    align: "center",
                  },
                ],
              },
              body: {
                type: "box",
                layout: "vertical",
                paddingAll: "xl",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: room.name,
                    weight: "bold",
                    size: "xl",
                    color: "#16a085",
                    align: "center",
                    wrap: true,
                  },
                  {
                    type: "separator",
                    margin: "md",
                    color: "#e5e7eb",
                  },
                  {
                    type: "text",
                    text: `ห้องนี้จะหมดอายุในอีก ${daysLeft} วัน\n(${expiryStr})`,
                    size: "sm",
                    color: "#6b7280",
                    wrap: true,
                    align: "center",
                    margin: "md",
                  },
                  {
                    type: "text",
                    text: "กรุณาชำระค่าบริการเพื่อต่ออายุก่อนห้องถูกล็อค",
                    size: "xs",
                    color: "#9ca3af",
                    wrap: true,
                    align: "center",
                    margin: "sm",
                  },
                ],
              },
              footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "md",
                contents: [
                  {
                    type: "button",
                    style: "primary",
                    color: "#f59e0b",
                    height: "sm",
                    action: {
                      type: "postback",
                      label: "💳 ชำระค่าบริการ",
                      data: `action=subscribe&room_id=${room.id}`,
                    },
                  },
                ],
              },
            },
          },
        ],
      });

      logger.info(`[SubscriptionCron] Warned manager of room "${room.name}" (expires in ${daysLeft} days)`);
    } catch (e) {
      logger.error(`[SubscriptionCron] Failed to warn manager ${room.manager.lineUid}: ${e.message}`);
    }
  }
}

// ─── Lock expired rooms ─────────────────────────────────────────
async function lockExpiredRooms(now) {
  const rooms = await prisma.room.findMany({
    where: {
      isPremium: false,
      expiresAt: {
        lte: now,
        not: null,
      },
    },
    include: {
      manager: true,
    },
  });

  for (const room of rooms) {
    // Lock the room
    await prisma.room.update({
      where: { id: room.id },
      data: { isPremium: true },
    });

    logger.info(`[SubscriptionCron] Locked room "${room.name}" (expired at ${room.expiresAt.toISOString()})`);

    // Notify manager
    if (!room.manager) continue;

    try {
      await lineClient.pushMessage({
        to: room.manager.lineUid,
        messages: [
          {
            type: "flex",
            altText: `🔒 ห้อง "${room.name}" ถูกล็อคแล้ว`,
            contents: {
              type: "bubble",
              size: "kilo",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#ef4444",
                paddingAll: "lg",
                contents: [
                  {
                    type: "text",
                    text: "🔒 ห้องถูกล็อค",
                    weight: "bold",
                    size: "lg",
                    color: "#ffffff",
                    align: "center",
                  },
                ],
              },
              body: {
                type: "box",
                layout: "vertical",
                paddingAll: "xl",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: room.name,
                    weight: "bold",
                    size: "xl",
                    color: "#ef4444",
                    align: "center",
                    wrap: true,
                  },
                  {
                    type: "separator",
                    margin: "md",
                    color: "#e5e7eb",
                  },
                  {
                    type: "text",
                    text: "ห้องนี้หมดอายุแล้ว\nกรุณาชำระค่าบริการเพื่อปลดล็อค",
                    size: "sm",
                    color: "#6b7280",
                    wrap: true,
                    align: "center",
                    margin: "md",
                  },
                ],
              },
              footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "md",
                contents: [
                  {
                    type: "button",
                    style: "primary",
                    color: "#ef4444",
                    height: "sm",
                    action: {
                      type: "postback",
                      label: "💳 ชำระเงินเพื่อปลดล็อค",
                      data: `action=subscribe&room_id=${room.id}`,
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    } catch (e) {
      logger.error(`[SubscriptionCron] Failed to notify manager ${room.manager.lineUid}: ${e.message}`);
    }
  }
}
