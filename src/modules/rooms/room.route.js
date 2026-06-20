import { Router } from "express";
import * as roomController from "./room.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/my-rooms", roomController.getMyRooms);
router.get("/", roomController.getAll);
router.get("/by-group/:groupId", roomController.getByGroupId);
router.get("/:id", roomController.getById);
router.post("/", roomController.create);
router.patch("/:id", authenticate, roomController.update);
router.delete("/:id", authenticate, roomController.remove);
router.post("/:id/sync-members", roomController.syncMembers);
router.get("/:id/members", roomController.getMembers);
router.delete("/:id/members/:userId", authenticate, roomController.removeMember);
router.post("/:id/generate-bills", authenticate, roomController.generateBills);

export default router;
