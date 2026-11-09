import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { patientFromSession, requestContext } from "@/lib/session";
import { loadOwnReport } from "@/lib/portal";
import { ReportDocument } from "@/lib/pdf/ReportDocument";

// Patient-portal PDF download. Ownership (the session's patientId) and status
// (FINALIZED) are enforced in loadOwnReport; anything else is a plain 404 so
// the response never confirms that another patient's report id exists.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = patientFromSession(await auth());
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.patientAccount.findUnique({
    where: { id: me.accountId },
    select: { mustChangePassword: true, isActive: true },
  });
  if (!account?.isActive) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (account.mustChangePassword) {
    return NextResponse.json({ error: "Please change your temporary password first." }, { status: 403 });
  }

  const { id } = await params;
  const data = await loadOwnReport(me, id, await requestContext());
  if (!data) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const buffer = await renderToBuffer(ReportDocument({ data }));
  const filename = `breath-test-report-${id.slice(0, 8)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
