import * as roomService from "./room.service.js";
import { validateCreateRoom, validateUpdateRoom } from "./room.validation.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";

export async function getAll(req, res, next) {
  try {
    const rooms = await roomService.getAllRooms();
    return success(res, rooms);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const room = await roomService.getRoomById(req.params.id);
    return success(res, room);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const errs = validateCreateRoom(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const room = await roomService.createRoom(req.body);
    return success(res, room, "สร้างห้องสำเร็จเรียบร้อย!", STATUS_CODE.CREATED);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const errs = validateUpdateRoom(req.body);
    if (errs.length) {
      return error(res, "Validation failed", STATUS_CODE.UNPROCESSABLE, errs);
    }

    const room = await roomService.updateRoom(
      req.params.id,
      req.body,
      req.userId,
    );
    return success(res, room, "Room updated");
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await roomService.deleteRoom(req.params.id, req.userId);
    return success(res, null, "Room deleted", STATUS_CODE.NO_CONTENT);
  } catch (err) {
    next(err);
  }
}
