import * as roomService from "./room.service.js";
import { validateCreateRoom, validateUpdateRoom } from "./room.validation.js";
import { success, error } from "../../utils/response.js";
import { STATUS_CODE } from "../../constants/statusCode.js";

export async function syncMembers(req, res, next) {
  try {
    const result = await roomService.syncMembers(req.params.id);
    return success(res, result, "Synced members successfully");
  } catch (err) {
    next(err);
  }
}

export async function getAll(req, res, next) {
  try {
    const rooms = await roomService.getAllRooms();
    return success(res, rooms);
  } catch (err) {
    next(err);
  }
}

export async function getMyRooms(req, res, next) {
  try {
    const { lineUid } = req.query;
    if (!lineUid) {
      return error(res, "lineUid is required", STATUS_CODE.BAD_REQUEST);
    }
    const rooms = await roomService.getMyRooms(lineUid);
    return success(res, rooms);
  } catch (err) {
    next(err);
  }
}

export async function getByGroupId(req, res, next) {
  try {
    const room = await roomService.getRoomByGroupId(req.params.groupId);
    return success(res, room);
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

export async function getMembers(req, res, next) {
  try {
    const members = await roomService.getMembers(req.params.id);
    return success(res, members);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    await roomService.removeMember(req.params.id, req.params.userId, req.userId);
    return success(res, null, "Member removed", STATUS_CODE.NO_CONTENT);
  } catch (err) {
    next(err);
  }
}
