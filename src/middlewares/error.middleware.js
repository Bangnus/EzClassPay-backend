import { error } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { STATUS_CODE } from "../constants/statusCode.js";

export function errorHandler(err, _req, res, _next) {
  logger.error(err.stack || err.message);

  if (err.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") {
      return error(res, "Resource already exists", STATUS_CODE.CONFLICT);
    }
    return error(res, "Database error", STATUS_CODE.INTERNAL_SERVER_ERROR);
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return error(res, "Invalid or expired token", STATUS_CODE.UNAUTHORIZED);
  }

  return error(
    res,
    err.message || "Internal Server Error",
    err.statusCode || STATUS_CODE.INTERNAL_SERVER_ERROR
  );
}

export function notFound(_req, res) {
  return error(res, "Route not found", STATUS_CODE.NOT_FOUND);
}
