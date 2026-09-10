import { Router, type Request, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  return res.json((req as AuthenticatedRequest).auth);
});

export default router;