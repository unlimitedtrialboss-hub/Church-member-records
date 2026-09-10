import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/auth/me", requireAuth, (req, res) => {
  return res.json((req as AuthenticatedRequest).auth);
});

export default router;