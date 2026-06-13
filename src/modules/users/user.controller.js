import * as userService from "./user.service.js";
import { validateUpdateProfile } from "./user.validation.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";

export async function getAll(req, res, next) {
  try {
    const users = await userService.getAllUsers();
    return success(res, users);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const errs = validateUpdateProfile(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const user = await userService.updateUser(req.params.id, req.body);
    return success(res, user, "User updated");
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await userService.deleteUser(req.params.id);
    return success(res, null, "User deleted", STATUS_CODE.NO_CONTENT);
  } catch (err) {
    next(err);
  }
}
