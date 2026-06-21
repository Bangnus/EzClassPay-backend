import * as subscriptionService from "./subscription.service.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";
import prisma from "../../config/database.js";

// POST /api/subscriptions/checkout
export async function createCheckout(req, res, next) {
  try {
    const { roomId, lineUid } = req.body;

    if (!roomId || !lineUid) {
      return error(res, "roomId and lineUid are required", STATUS_CODE.BAD_REQUEST);
    }

    // Resolve managerId from lineUid
    const user = await prisma.user.findUnique({ where: { lineUid } });
    if (!user) {
      return error(res, "User not found", STATUS_CODE.NOT_FOUND);
    }

    const result = await subscriptionService.createCheckoutSession(roomId, user.id);
    return success(res, result, "Checkout session created");
  } catch (err) {
    next(err);
  }
}

// GET /api/subscriptions/room/:roomId
export async function getByRoom(req, res, next) {
  try {
    const subs = await subscriptionService.getSubscriptionsByRoom(req.params.roomId);
    return success(res, subs);
  } catch (err) {
    next(err);
  }
}

// GET /api/subscriptions/success (redirect from Stripe)
export async function handleSuccess(req, res) {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ชำระเงินสำเร็จ — EzClassPay</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
        }
        .card {
          background: #fff; border-radius: 16px; padding: 40px;
          text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          max-width: 400px;
        }
        .icon { font-size: 64px; margin-bottom: 16px; }
        h1 { color: #16a34a; font-size: 24px; margin-bottom: 8px; }
        p { color: #6b7280; font-size: 14px; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">✅</div>
        <h1>ชำระเงินสำเร็จ!</h1>
        <p>ห้องของคุณได้รับการปลดล็อคแล้ว<br>คุณสามารถปิดหน้านี้ได้เลย</p>
      </div>
    </body>
    </html>
  `);
}

// GET /api/subscriptions/cancel (redirect from Stripe)
export async function handleCancel(req, res) {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ยกเลิกการชำระเงิน — EzClassPay</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #fef2f2, #fecaca);
        }
        .card {
          background: #fff; border-radius: 16px; padding: 40px;
          text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          max-width: 400px;
        }
        .icon { font-size: 64px; margin-bottom: 16px; }
        h1 { color: #ef4444; font-size: 24px; margin-bottom: 8px; }
        p { color: #6b7280; font-size: 14px; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">❌</div>
        <h1>ยกเลิกการชำระเงิน</h1>
        <p>คุณสามารถกลับมาชำระเงินได้ทุกเมื่อ<br>ผ่านปุ่ม "ชำระเงินเพื่อปลดล็อค" ใน LINE</p>
      </div>
    </body>
    </html>
  `);
}
