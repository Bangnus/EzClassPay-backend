import { Router } from "express";
import * as roomController from "./room.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/", roomController.getAll);
router.get("/:id", roomController.getById);
router.post("/", roomController.create);
router.patch("/:id", authenticate, roomController.update);
router.delete("/:id", authenticate, roomController.remove);
router.post("/:id/sync-members", roomController.syncMembers);

export default router;
