import { generateToken } from "../../utils/generateToken.js";
import * as authRepo from "./auth.repository.js";

export async function loginWithLine({ lineUid, displayName, pictureUrl }) {
  const user = await authRepo.upsertByLineUid(lineUid, { displayName, pictureUrl });

  const token = generateToken({ userId: user.id });

  return {
    token,
    user: {
      id: user.id,
      lineUid: user.lineUid,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
      email: user.email,
      role: user.role,
    },
  };
}

export async function getProfile(userId) {
  const user = await authRepo.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  return {
    id: user.id,
    lineUid: user.lineUid,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}
