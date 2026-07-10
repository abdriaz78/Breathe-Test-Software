import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { loadReportData } from "@/lib/report";
import { sampleTotal } from "@/lib/sample-math";
import { toCsv, csvResponse } from "@/lib/csv";
import { recordAudit } from "@/lib/audit";
import { requestContext } from "@/lib/session";

export const runtime = "nodejs";

function isoDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "report:export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const data = await loadReportData(id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const headers = [
    "Test ID", "MRN", "Patient", "Test Type", "Collection Date",
    "Sample #", "Time (min)", "H2 (ppm)", "CH4 (ppm)", "H2+CH4 (ppm)",
    "CO2 (%)", "Correction Factor", "Symptoms", "Skipped", "Skipped Reason",
  ];
  const rows = data.samples.map((s) => [
    data.id, data.patient.mrn, data.patient.name, data.test.typeName, isoDate(data.test.collectionDate),
    s.sampleNumber, s.timeMinutes, s.h2Ppm, s.ch4Ppm, sampleTotal(s.h2Ppm, s.ch4Ppm),
    s.co2Percent, s.correctionFactor, s.symptoms, s.skipped ? "yes" : "no", s.skippedReason,
  ]);

  const csv = toCsv(headers, rows);

  const ctx = await requestContext();
  await recordAudit({
    action: "EXPORT", entity: "BreathTest", entityId: id, breathTestId: id,
    actorId: session.user.id, actorRole: session.user.role,
    summary: `Exported samples CSV (patient MRN ${data.patient.mrn})`,
    metadata: { format: "csv", scope: "samples", rows: rows.length }, ...ctx,
  });

  return csvResponse(`samples-${data.patient.mrn}-${id.slice(0, 8)}.csv`, csv);
}
