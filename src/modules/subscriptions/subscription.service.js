import Stripe from "stripe";
import prisma from "../../config/database.js";
import { lineClient } from "../line/line.service.js";
import { logger } from "../../utils/logger.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_DAYS = 30;

function getSubscriptionPrice() {
  return parseInt(process.env.SUBSCRIPTION_PRICE_THB || "9900", 10); // สตางค์ (99.00 บาท)
}

// ─── Create Stripe Payment Intent for PromptPay ────────────────────────
export async function createPromptPayIntent(roomId, managerId) {
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

  // 1. ลองค้นหารายการที่รอชำระ (PENDING) เดิมในระบบ
  const existingSub = await prisma.subscription.findFirst({
    where: {
      roomId: room.id,
      managerId: manager.id,
      status: "PENDING"
    }
  });

  // ถ้ามีรายการเดิมอยู่ ลองดึงข้อมูลจาก Stripe มาดูว่ายังใช้ได้ไหม
  if (existingSub) {
    try {
      const existingIntent = await stripe.paymentIntents.retrieve(existingSub.stripeIntentId);
      if (existingIntent.status === "requires_action" || existingIntent.status === "requires_payment_method") {
        const qrCodeUrl = existingIntent.next_action?.promptpay_display_qr_code?.image_url_png;
        const hostedInstructionsUrl = existingIntent.next_action?.promptpay_display_qr_code?.hosted_instructions_url;
        
        if (qrCodeUrl) {
          logger.info(`[Subscription] Reusing existing PaymentIntent ${existingIntent.id}`);
          return { 
            qrCodeUrl, 
            hostedInstructionsUrl, 
            intentId: existingIntent.id, 
            amount: existingSub.amount 
          };
        }
      }
    } catch (e) {
      logger.warn(`[Subscription] Failed to retrieve existing intent ${existingSub.stripeIntentId}: ${e.message}`);
    }
  }

  // 2. ถ้าไม่มีรายการเดิม หรือรายการเดิมหมดอายุแล้ว -> สร้าง PaymentIntent ใหม่
  const paymentIntent = await stripe.paymentIntents.create({
    amount: priceAmount,
    currency: "thb",
    payment_method_types: ["promptpay"],
    payment_method_data: {
      type: "promptpay",
      billing_details: {
        email: `${manager.id}@ezclasspay.com` // Stripe ต้องการอีเมลสำหรับ PromptPay
      }
    },
    confirm: true,
    metadata: {
      roomId: room.id,
      managerId: manager.id,
      planDays: String(PLAN_DAYS),
    },
    return_url: `${process.env.PUBLIC_API_URL || "https://example.com"}/api/subscriptions/success`,
  });

  const qrCodeUrl = paymentIntent.next_action?.promptpay_display_qr_code?.image_url_png;
  const hostedInstructionsUrl = paymentIntent.next_action?.promptpay_display_qr_code?.hosted_instructions_url;
  
  if (!qrCodeUrl) {
    throw new Error("Failed to generate PromptPay QR code");
  }

  // 3. บันทึกหรืออัปเดตลงฐานข้อมูล
  if (existingSub) {
    // อัปเดต row เดิมเพื่อไม่ให้เปลืองพื้นที่
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        stripeIntentId: paymentIntent.id,
        amount: priceAmount / 100,
        createdAt: new Date(), // อัปเดตเวลาให้เป็นปัจจุบัน
      }
    });
  } else {
    // สร้างใหม่ถ้าไม่เคยมี
    await prisma.subscription.create({
      data: {
        roomId: room.id,
        managerId: manager.id,
        stripeIntentId: paymentIntent.id,
        amount: priceAmount / 100,
        currency: "thb",
        status: "PENDING",
        planDays: PLAN_DAYS,
      },
    });
  }

  return { 
    qrCodeUrl, 
    hostedInstructionsUrl,
    intentId: paymentIntent.id, 
    amount: priceAmount / 100 
  };
}

// ─── Handle Stripe Webhook: payment_intent.succeeded ────────────
export async function handlePaymentIntentSucceeded(paymentIntent) {
  const { roomId, managerId, planDays } = paymentIntent.metadata;

  // 1. Update subscription record
  const subscription = await prisma.subscription.findUnique({
    where: { stripeIntentId: paymentIntent.id },
  });

  if (!subscription) {
    logger.warn(`[Stripe] No subscription found for intent ${paymentIntent.id}`);
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
      stripePaymentId: paymentIntent.id,
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
