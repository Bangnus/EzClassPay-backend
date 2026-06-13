import jwt from "jsonwebtoken";
import env from "../config/env.js";

export function generateToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}
