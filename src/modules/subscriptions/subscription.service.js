import Stripe from "stripe";
import prisma from "../../config/database.js";
import { lineClient } from "../line/line.service.js";
import { logger } from "../../utils/logger.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_DAYS = 30;

function getSubscriptionPrice() {
  return parseInt(process.env.SUBSCRIPTION_PRICE_THB || "9900", 10); // สตางค์ (99.00 บาท)
}

// ─── Create Stripe Checkout Session ──────────────────────────────
export async function createCheckoutSession(roomId, managerId) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    const error = new Error("Room not found");
    error.statusCode = 404;
    throw error;
  }

  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (!manager) {
    const error = new Error("Manager not found");
    error.statusCode = 404;
    throw error;
  }

  if (room.managerId !== managerId) {
    const error = new Error("Only the room manager can subscribe");
    error.statusCode = 403;
    throw error;
  }

  const priceAmount = getSubscriptionPrice();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["promptpay", "card"],
    line_items: [
      {
        price_data: {
          currency: "thb",
          product_data: {
            name: `EzClassPay — ต่ออายุห้อง "${room.name}"`,
            description: `ค่าบริการ ${PLAN_DAYS} วัน`,
          },
          unit_amount: priceAmount,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.PUBLIC_API_URL}/api/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.PUBLIC_API_URL}/api/subscriptions/cancel`,
    metadata: {
      roomId: room.id,
      managerId: manager.id,
      planDays: String(PLAN_DAYS),
    },
  });

  // Save pending subscription record
  await prisma.subscription.create({
    data: {
      roomId: room.id,
      managerId: manager.id,
      stripeSessionId: session.id,
      amount: priceAmount / 100, // store as baht
      currency: "thb",
      status: "PENDING",
      planDays: PLAN_DAYS,
    },
  });

  return { url: session.url, sessionId: session.id };
}

// ─── Handle Stripe Webhook: checkout.session.completed ───────────
export async function handleCheckoutCompleted(session) {
  const { roomId, managerId, planDays } = session.metadata;

  // 1. Update subscription record
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSessionId: session.id },
  });

  if (!subscription) {
    logger.warn(`[Stripe] No subscription found for session ${session.id}`);
    return;
  }

  if (subscription.status === "COMPLETED") {
    logger.info(`[Stripe] Subscription ${subscription.id} already completed, skipping`);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "COMPLETED",
      stripePaymentId: session.payment_intent,
      completedAt: new Date(),
    },
  });

  // 2. Unlock room and extend expiry
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return;

  const days = parseInt(planDays, 10) || PLAN_DAYS;
  const baseDate = room.expiresAt && room.expiresAt > new Date() ? room.expiresAt : new Date();
  const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.room.update({
    where: { id: roomId },
    data: {
      isPremium: false,
      expiresAt: newExpiry,
    },
  });

  // 3. Notify manager via LINE
  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (manager) {
    try {
      const expiryStr = newExpiry.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      await lineClient.pushMessage({
        to: manager.lineUid,
        messages: [
          {
            type: "flex",
            altText: `✅ ห้อง "${room.name}" ปลดล็อคแล้ว!`,
            contents: {
              type: "bubble",
              size: "kilo",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#16a34a",
                paddingAll: "lg",
                contents: [
                  {
                    type: "text",
                    text: "✅ ปลดล็อคสำเร็จ!",
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
                    text: `ห้องของคุณพร้อมใช้งานจนถึง\n${expiryStr}`,
                    size: "sm",
                    color: "#6b7280",
                    wrap: true,
                    align: "center",
                    margin: "md",
                  },
                ],
              },
            },
          },
        ],
      });
    } catch (e) {
      logger.error(`[Stripe] Failed to notify manager: ${e.message}`);
    }
  }

  logger.info(`[Stripe] Room "${room.name}" unlocked until ${newExpiry.toISOString()}`);
}

// ─── Get subscription history for a room ─────────────────────────
export async function getSubscriptionsByRoom(roomId) {
  return prisma.subscription.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Verify Stripe webhook signature ─────────────────────────────
export function constructEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}
