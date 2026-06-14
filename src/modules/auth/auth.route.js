import { Router } from "express";
import * as authController from "./auth.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/line-login", authController.lineLogin);
router.post("/sync", authController.sync);
router.get("/me", authenticate, authController.getProfile);

export default router;
