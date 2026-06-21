import { Router } from "express";
import * as ctrl from "./subscription.controller.js";

const router = Router();

// Create Stripe checkout session
router.post("/checkout", ctrl.createCheckout);

// Get subscription history for a room
router.get("/room/:roomId", ctrl.getByRoom);

// Stripe redirect pages
router.get("/success", ctrl.handleSuccess);
router.get("/cancel", ctrl.handleCancel);

export default router;
