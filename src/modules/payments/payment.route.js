import { Router } from "express";
import * as paymentController from "./payment.controller.js";

const router = Router();

router.post("/initiate", paymentController.initiate);
router.patch("/:id/approve", paymentController.approve);
router.patch("/:id/reject", paymentController.reject);
router.get("/room/:roomId/history", paymentController.history);
router.get("/room/:roomId/pending", paymentController.pending);

export default router;
