import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/auth/me", requireAuth, (req, res) => {
  return res.json((req as AuthenticatedRequest).auth);
});

export default router;