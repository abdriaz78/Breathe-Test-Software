import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { loadReportData } from "@/lib/report";
import { ReportDocument } from "@/lib/pdf/ReportDocument";
import { recordAudit } from "@/lib/audit";
import { isOutsideScope, requestContext, staffFromSession } from "@/lib/session";

// PDF generation runs in the Node runtime (react-pdf is not edge-compatible).
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = staffFromSession(await auth());
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(user.role, "report:export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const data = await loadReportData(id);
  if (!data) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (isOutsideScope(user, data.hospitalId)) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(ReportDocument({ data }));

  const ctx = await requestContext();
  await recordAudit({
    action: "EXPORT",
    entity: "BreathTest",
    entityId: id,
    breathTestId: id,
    actorId: user.id,
    actorRole: user.role,
    summary: `Exported PDF report (patient MRN ${data.patient.mrn}, status ${data.status})`,
    metadata: { format: "pdf", status: data.status },
    ...ctx,
  });

  const filename = `breath-test-${data.patient.mrn}-${id.slice(0, 8)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
