import { Router } from "express";
import { constructEvent, handleCheckoutCompleted } from "./subscription.service.js";
import { logger } from "../../utils/logger.js";

const router = Router();

// Stripe sends raw body — this route must be mounted BEFORE express.json()
router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    logger.warn("[StripeWebhook] Missing stripe-signature header");
    return res.status(400).send("Missing stripe-signature header");
  }

  let event;
  try {
    event = constructEvent(req.body, signature);
  } catch (err) {
    logger.error(`[StripeWebhook] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info(`[StripeWebhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }
      default:
        logger.info(`[StripeWebhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    logger.error(`[StripeWebhook] Error handling event: ${err.message}`);
    // Still return 200 to prevent Stripe from retrying
  }

  res.status(200).json({ received: true });
});

export default router;
