import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { auditLogs, db, profiles } from "@workspace/db";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireSuperadmin, type AuthenticatedRequest } from "../middleware/auth.js";
import { writeAuditLog } from "../lib/audit.js";

const router = Router();

router.use(requireAuth, requireSuperadmin);

router.get("/admin/users", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return res.status(502).json({ error: error.message });
  const profileRows = await db.select().from(profiles);
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  return res.json(data.users.map((user) => ({
    id: user.id,
    email: user.email,
    fullName: profileById.get(user.id)?.fullName ?? user.user_metadata?.full_name ?? null,
    role: profileById.get(user.id)?.role ?? null,
    createdAt: user.created_at,
  })));
});

router.get("/admin/audit-logs", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return res.status(502).json({ error: error.message });
  const emails = new Map(data.users.map((user) => [user.id, user.email]));
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
  return res.json(logs.map((log) => ({ ...log, actorEmail: emails.get(log.actorId) ?? "Unknown user" })));
});

router.patch("/admin/users/:id", async (req: Request<{ id: string }>, res: Response) => {
  const actor = (req as AuthenticatedRequest).auth;
  const targetId = req.params.id;
  const requestedRole = req.body?.role;
  if (!actor || targetId === actor.id) return res.status(400).json({ error: "You cannot change your own superadmin role." });
  if (requestedRole !== "admin" && requestedRole !== "remove") return res.status(400).json({ error: "Role must be admin or remove." });

  const { data: target, error: userError } = await supabase.auth.admin.getUserById(targetId);
  if (userError || !target.user) return res.status(404).json({ error: "Auth user not found." });

  if (requestedRole === "remove") {
    await db.delete(profiles).where(eq(profiles.id, targetId));
  } else {
    await db.insert(profiles).values({ id: targetId, email: target.user.email ?? null, fullName: target.user.user_metadata?.full_name ?? target.user.email ?? null, role: "admin" }).onConflictDoUpdate({ target: profiles.id, set: { email: target.user.email ?? null, role: "admin", updatedAt: new Date() } });
  }

  await writeAuditLog({ actorId: actor.id, action: requestedRole === "remove" ? "remove_admin_access" : "grant_admin_access", entityType: "user", entityId: targetId, details: { email: target.user.email } });

  return res.json({ id: targetId, role: requestedRole === "remove" ? null : "admin" });
});

export default router;