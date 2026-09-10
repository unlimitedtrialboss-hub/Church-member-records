import { Router, type Response } from "express";

const router = Router();

router.get("/healthz", (_req: unknown, res: Response) => {
  res.json({ status: "ok" });
});

export default router;
