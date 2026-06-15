import { Router } from "express";
import * as expenseController from "./expense.controller.js";

const router = Router();

router.post("/", expenseController.create);
router.get("/:id", expenseController.getById);
router.get("/room/:roomId", expenseController.getByRoom);

export default router;
