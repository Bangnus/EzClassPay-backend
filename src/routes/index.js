import { Router } from "express";
import authRoutes from "../modules/auth/auth.route.js";
import userRoutes from "../modules/users/user.route.js";
import roomRoutes from "../modules/rooms/room.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);

export default router;
