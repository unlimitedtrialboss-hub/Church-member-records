import { Router, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json(req.auth);
});

export default router;