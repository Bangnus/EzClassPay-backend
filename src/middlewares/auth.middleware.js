import jwt from "jsonwebtoken";
import env from "../config/env.js";
import prisma from "../config/database.js";
import { error } from "../utils/response.js";
import { STATUS_CODE } from "../constants/statusCode.js";

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return error(res, "No token provided", STATUS_CODE.UNAUTHORIZED);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, lineUid: true, displayName: true, pictureUrl: true },
    });

    if (!user) {
      return error(res, "User not found", STATUS_CODE.UNAUTHORIZED);
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    return error(res, "Invalid or expired token", STATUS_CODE.UNAUTHORIZED);
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, "Forbidden", STATUS_CODE.FORBIDDEN);
    }
    next();
  };
}
