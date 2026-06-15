import * as expenseService from "./expense.service.js";
import { validateCreateExpense } from "./expense.validation.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";

export async function create(req, res, next) {
  try {
    const errs = validateCreateExpense(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const expense = await expenseService.createExpense(req.body);
    return success(res, expense, "Expense created", STATUS_CODE.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const expense = await expenseService.getExpenseById(Number(req.params.id));
    return success(res, expense);
  } catch (err) {
    next(err);
  }
}

export async function getByRoom(req, res, next) {
  try {
    const expenses = await expenseService.getExpensesByRoomId(req.params.roomId);
    return success(res, expenses);
  } catch (err) {
    next(err);
  }
}
