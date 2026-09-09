import { Router, type IRouter } from "express";
import healthRouter from "./health";
import membersRouter from "./members";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(membersRouter);
router.use(storageRouter);

export default router;
