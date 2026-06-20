import { Router } from "express";
import * as roomController from "./room.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/my-rooms", roomController.getMyRooms);
router.get("/", roomController.getAll);
router.get("/by-group/:groupId", roomController.getByGroupId);
router.get("/:id", roomController.getById);
router.post("/", roomController.create);
router.patch("/:id", roomController.update);
router.delete("/:id", roomController.remove);
router.post("/:id/sync-members", roomController.syncMembers);
router.get("/:id/members", roomController.getMembers);
router.delete("/:id/members/:userId", roomController.removeMember);
router.post("/:id/generate-bills", roomController.generateBills);

export default router;
