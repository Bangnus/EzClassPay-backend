import { Router } from "express";
import authRoutes from "../modules/auth/auth.route.js";
import userRoutes from "../modules/users/user.route.js";
import roomRoutes from "../modules/rooms/room.route.js";
import expenseRoutes from "../modules/expenses/expense.route.js";
import billRoutes from "../modules/bills/bill.route.js";
import paymentRoutes from "../modules/payments/payment.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/expenses", expenseRoutes);
router.use("/bills", billRoutes);
router.use("/payments", paymentRoutes);

export default router;
