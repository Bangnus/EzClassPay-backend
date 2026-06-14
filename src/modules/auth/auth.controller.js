import * as authService from "./auth.service.js";
import { validateLineLogin } from "./auth.validation.js";
import { validateSync } from "./sync.validation.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";

export async function lineLogin(req, res, next) {
  try {
    const errs = validateLineLogin(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const result = await authService.loginWithLine(req.body);
    return success(res, result, "Login successful");
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req, res, next) {
  try {
    const profile = await authService.getProfile(req.userId);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function sync(req, res, next) {
  try {
    const errs = validateSync(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const result = await authService.syncUser(req.body);
    return success(res, result, "Sync successful");
  } catch (err) {
    next(err);
  }
}
