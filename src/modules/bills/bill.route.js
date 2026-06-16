import { Router } from "express";
import * as billController from "./bill.controller.js";

const router = Router();

router.get("/room/:roomId", billController.getBillsByRoom);
router.get("/user/:userId", billController.getBillsByUser);
router.get("/:id", billController.getBillById);
router.patch("/:id/status", billController.updateBillStatus);
router.post("/generate", billController.generateBills);

export default router;
