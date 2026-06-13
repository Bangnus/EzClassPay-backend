import { Router } from "express";
import * as userController from "./user.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { ROLES } from "../../constants/roles.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize(ROLES.MANAGER), userController.getAll);
router.get("/:id", userController.getById);
router.patch("/:id", userController.update);
router.delete("/:id", authorize(ROLES.MANAGER), userController.remove);

export default router;
