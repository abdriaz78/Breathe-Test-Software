import { NextResponse } from "next/server";
import type { ReportStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTestsForExport } from "@/lib/tests";
import { toCsv, csvResponse } from "@/lib/csv";
import { recordAudit } from "@/lib/audit";
import { requestContext, staffFromSession } from "@/lib/session";

export const runtime = "nodejs";

const STATUSES: ReportStatus[] = ["DRAFT", "IN_PROGRESS", "FINALIZED"];

function isoDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export async function GET(req: Request) {
  const actor = staffFromSession(await auth());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(actor.role, "report:export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = STATUSES.includes(statusParam as ReportStatus)
    ? (statusParam as ReportStatus)
    : undefined;

  const rows = await listTestsForExport(actor, { status });

  const headers = [
    "Test ID", "MRN", "Patient", "Test Type", "Status",
    "Collection Date", "Analysis Date", "Samples", "Signed By", "Created",
  ];
  const csvRows = rows.map((t) => [
    t.id, t.mrn, t.patientName, t.testType, t.status,
    isoDate(t.collectionDate), isoDate(t.analysisDate), t.sampleCount, t.signedBy, isoDate(t.createdAt),
  ]);

  const csv = toCsv(headers, csvRows);

  const ctx = await requestContext();
  await recordAudit({
    action: "EXPORT", entity: "BreathTest",
    actorId: actor.id, actorRole: actor.role,
    summary: `Exported tests summary CSV (${rows.length} rows${status ? `, ${status}` : ""})`,
    metadata: { format: "csv", scope: "tests-summary", rows: rows.length, status }, ...ctx,
  });

  const suffix = status ? `-${status.toLowerCase()}` : "";
  return csvResponse(`breath-tests${suffix}.csv`, csv);
}
