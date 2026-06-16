import * as billService from "./bill.service.js";
import {
  validateGenerateBills,
  validateUpdateBillStatus,
} from "./bill.validation.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";

export async function getBillsByRoom(req, res, next) {
  try {
    const { roomId } = req.params;
    const options = {};
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
    if (req.query.lineUid) options.lineUid = req.query.lineUid;
    const bills = await billService.getBillsByRoom(roomId, options);
    return success(res, bills);
  } catch (err) {
    next(err);
  }
}

export async function getBillsByUser(req, res, next) {
  try {
    const { userId } = req.params;
    const options = {};
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
    const bills = await billService.getBillsByUser(userId, options);
    return success(res, bills);
  } catch (err) {
    next(err);
  }
}

export async function getBillById(req, res, next) {
  try {
    const bill = await billService.getBillById(req.params.id);
    return success(res, bill);
  } catch (err) {
    next(err);
  }
}

export async function updateBillStatus(req, res, next) {
  try {
    const errs = validateUpdateBillStatus(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const bill = await billService.updateBillStatus(req.params.id, req.body.status);
    return success(res, bill, "Bill status updated");
  } catch (err) {
    next(err);
  }
}

export async function generateBills(req, res, next) {
  try {
    const errs = validateGenerateBills(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const results = await billService.generateMonthlyBills(
      req.body.month,
      req.body.year
    );
    return success(res, results, "Bills generated successfully", 201);
  } catch (err) {
    next(err);
  }
}
