"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { requestContext } from "@/lib/session";

const shareSchema = z.object({
  testId: z.string().min(1),
  recipient: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  method: z.enum(["email", "link"]),
});

export interface ShareState {
  error?: string;
  ok?: string;
}

/** Records that a report was shared (audited). Does not send email itself —
 * email delivery is a deployment-phase integration; the client opens a mailto
 * draft. Sharing is gated on report:share. */
export async function recordShareAction(
  _prev: ShareState,
  formData: FormData
): Promise<ShareState> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };
  if (!can(session.user.role, "report:share")) return { error: "You do not have permission to share." };

  const parsed = shareSchema.safeParse({
    testId: String(formData.get("testId") ?? ""),
    recipient: String(formData.get("recipient") ?? ""),
    method: String(formData.get("method") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { testId, recipient, method } = parsed.data;

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    select: { patient: { select: { mrn: true } } },
  });
  if (!test) return { error: "Test not found." };

  const ctx = await requestContext();
  await recordAudit({
    action: "EXPORT",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: session.user.id,
    actorRole: session.user.role,
    summary: `Shared report via ${method}${recipient ? ` to ${recipient}` : ""} (MRN ${test.patient.mrn})`,
    metadata: { scope: "share", method, recipient: recipient || null },
    ...ctx,
  });

  return { ok: method === "email" ? "Email draft opened and share logged." : "Link copied and share logged." };
}
