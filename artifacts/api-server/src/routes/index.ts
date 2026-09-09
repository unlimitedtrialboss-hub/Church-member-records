import { Router, type IRouter } from "express";
import healthRouter from "./health";
import membersRouter from "./members";
import storageRouter from "./storage";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(membersRouter);
router.use(storageRouter);

export default router;
