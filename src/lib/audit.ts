import type { AuditAction, Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";

// -----------------------------------------------------------------------------
// Audit logging helper.
//
// Every clinical mutation and every sensitive action (login, export, PHI view,
// finalize, reopen) should call `recordAudit`. NEVER put plaintext PHI in the
// metadata — store field names / ids, not patient names.
// -----------------------------------------------------------------------------

export interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary?: string;
  reason?: string; // required by callers for REOPEN
  metadata?: Prisma.InputJsonValue;
  actorId?: string | null;
  actorRole?: Role | null;
  breathTestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        reason: input.reason,
        metadata: input.metadata,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        breathTestId: input.breathTestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit failures must never break the primary operation, but we surface them.
    console.error("[audit] failed to record event", input.action, input.entity, err);
  }
}
