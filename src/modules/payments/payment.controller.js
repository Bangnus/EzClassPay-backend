import * as paymentService from "./payment.service.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";

export async function initiate(req, res, next) {
  try {
    const { lineUid, roomId, amount, billId } = req.body;
    if (!lineUid || !roomId) {
      return error(res, "lineUid and roomId are required", STATUS_CODE.UNPROCESSABLE);
    }
    const payment = await paymentService.initiatePayment({ lineUid, roomId, amount, billId });
    return success(res, payment, "Payment initiated", 201);
  } catch (err) {
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    const payment = await paymentService.approvePayment(req.params.id);
    return success(res, payment, "Payment approved");
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    const payment = await paymentService.rejectPayment(req.params.id);
    return success(res, payment, "Payment rejected");
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const options = {};
    if (req.query.userId) options.userId = req.query.userId;
    if (req.query.lineUid) options.lineUid = req.query.lineUid;
    const payments = await paymentService.getPaymentHistory(req.params.roomId, options);
    return success(res, payments);
  } catch (err) {
    next(err);
  }
}

export async function userHistory(req, res, next) {
  try {
    const { lineUid } = req.params;
    if (!lineUid) throw new Error("lineUid is required");
    const payments = await paymentService.getUserPaymentHistory(lineUid);
    return success(res, payments);
  } catch (err) {
    next(err);
  }
}

export async function pending(req, res, next) {
  try {
    const payments = await paymentService.getPendingPayments(req.params.roomId);
    return success(res, payments);
  } catch (err) {
    next(err);
  }
}
