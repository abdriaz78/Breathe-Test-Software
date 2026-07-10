import { NextResponse } from "next/server";
import type { ReportStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTestsForExport } from "@/lib/tests";
import { toCsv, csvResponse } from "@/lib/csv";
import { recordAudit } from "@/lib/audit";
import { requestContext } from "@/lib/session";

export const runtime = "nodejs";

const STATUSES: ReportStatus[] = ["DRAFT", "IN_PROGRESS", "FINALIZED"];

function isoDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "report:export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = STATUSES.includes(statusParam as ReportStatus)
    ? (statusParam as ReportStatus)
    : undefined;

  const actor = {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
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
    actorId: session.user.id, actorRole: session.user.role,
    summary: `Exported tests summary CSV (${rows.length} rows${status ? `, ${status}` : ""})`,
    metadata: { format: "csv", scope: "tests-summary", rows: rows.length, status }, ...ctx,
  });

  const suffix = status ? `-${status.toLowerCase()}` : "";
  return csvResponse(`breath-tests${suffix}.csv`, csv);
}
