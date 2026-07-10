import Link from "next/link";
import type { ReportStatus } from "@prisma/client";
import { requirePermission } from "@/lib/session";
import { listTests, STATUS_LABEL, STATUS_STYLE } from "@/lib/tests";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUSES: ReportStatus[] = ["DRAFT", "IN_PROGRESS", "FINALIZED"];

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePermission("test:read");
  const { status } = await searchParams;
  const statusFilter = STATUSES.includes(status as ReportStatus)
    ? (status as ReportStatus)
    : undefined;

  const tests = await listTests(user, { status: statusFilter });

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Breath Tests" }]}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Breath Tests</h1>
          <p className="text-sm text-slate-500">{tests.length} test(s)</p>
        </div>
        {can(user.role, "report:export") && (
          <a
            href={`/api/tests/export.csv${statusFilter ? `?status=${statusFilter}` : ""}`}
            className="btn-secondary"
          >
            Export CSV
          </a>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          href="/tests"
          className={`rounded-md px-3 py-1.5 text-sm ${!statusFilter ? "bg-brand text-white" : "bg-white text-slate-600 border border-clinical-border"}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/tests?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm transition-all duration-150 active:scale-95 ${statusFilter === s ? "bg-brand text-white shadow-sm" : "bg-white text-slate-600 border border-clinical-border hover:border-brand hover:text-brand"}`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-clinical-border bg-white">
        <table className="min-w-full divide-y divide-clinical-border text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">MRN</th>
              <th className="px-4 py-3">Test type</th>
              <th className="px-4 py-3">Collection</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-border">
            {tests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No tests found.
                </td>
              </tr>
            )}
            {tests.map((t) => (
              <tr key={t.id} className="transition-colors duration-150 hover:bg-brand/5">
                <td className="px-4 py-3 font-medium text-slate-900">{t.patientName}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{t.patientMrn}</td>
                <td className="px-4 py-3 text-slate-600">{t.testTypeName}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(t.collectionDate)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/tests/${t.id}`} className="text-brand hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
