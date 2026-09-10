import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import membersRouter from "./members.js";
import storageRouter from "./storage.js";
import authRouter from "./auth.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(membersRouter);
router.use(storageRouter);

export default router;
