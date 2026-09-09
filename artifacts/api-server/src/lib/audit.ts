import { db, auditLogs } from "@workspace/db";

export async function writeAuditLog(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details ?? {},
  });
}