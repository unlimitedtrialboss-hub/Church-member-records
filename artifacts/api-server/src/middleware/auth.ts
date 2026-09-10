import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, profiles } from "@workspace/db";
import { supabase } from "../lib/supabase.js";

export type AuthenticatedRequest = Parameters<RequestHandler>[0] & {
  auth?: { id: string; email?: string; role: "admin" | "superadmin"; fullName: string | null };
};

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication is required." });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Your session is invalid or expired." });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return res.status(403).json({ error: "Your account has no application role." });
  }

  (req as AuthenticatedRequest).auth = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role,
    fullName: profile.fullName,
  };
  return next();
};

export const requireSuperadmin: RequestHandler = (req, res, next) => {
  if ((req as AuthenticatedRequest).auth?.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin authorization is required." });
  }
  return next();
};