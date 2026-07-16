import { db, activityTable, auditLogTable } from "@workspace/db";
import type { Request } from "express";

export function parseId(req: Request): number {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  return parseInt(raw ?? "", 10);
}

export async function logActivity(
  type: string,
  message: string,
  entityType?: string,
  entityId?: number,
  userName?: string,
): Promise<void> {
  await db.insert(activityTable).values({
    type,
    message,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    userName: userName ?? null,
  });
}

export async function logAudit(
  action: string,
  entityType: string,
  entityId: number | null,
  detail: string,
  userId?: number | null,
  userName?: string | null,
): Promise<void> {
  await db.insert(auditLogTable).values({
    action,
    entityType,
    entityId,
    detail,
    userId: userId ?? null,
    userName: userName ?? null,
  });
}

// Convert Date objects to ISO strings so Zod response schemas (string dates) accept DB rows.
export function jsonify<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
