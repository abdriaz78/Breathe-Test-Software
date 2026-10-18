import Link from "next/link";
import type { ReportStatus } from "@prisma/client";
import { requirePermission } from "@/lib/session";
import { countTestsByStatus, listTests, STATUS_LABEL } from "@/lib/tests";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { TestsTable } from "@/components/ListTables";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/primitives";

const STATUSES: ReportStatus[] = ["DRAFT", "IN_PROGRESS", "FINALIZED"];
const DOT: Record<ReportStatus, string> = {
  DRAFT: "bg-slate-400",
  IN_PROGRESS: "bg-amber-400",
  FINALIZED: "bg-emerald-500",
};

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

  const [tests, counts] = await Promise.all([
    listTests(user, { status: statusFilter }),
    countTestsByStatus(user),
  ]);
  const total = counts.DRAFT + counts.IN_PROGRESS + counts.FINALIZED;
  const canCreate = can(user.role, "test:create");

  const chip = (active: boolean) =>
    `chip ${
      active
        ? "border-transparent bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-glow"
        : "border-clinical-border bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
    }`;
  const countPill = (active: boolean) =>
    `rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`;

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Breath Tests" }]}>
      <PageHeader
        title="Breath Tests"
        icon="flask"
        description="Track every test from setup to signed report."
        actions={
          <>
            {can(user.role, "report:export") && (
              <a
                href={`/api/tests/export.csv${statusFilter ? `?status=${statusFilter}` : ""}`}
                className="btn-secondary"
              >
                <Icon name="download" className="h-4 w-4" /> Export CSV
              </a>
            )}
            {canCreate && (
              <Link href="/patients" title="Choose a patient, then start the test from their record" className="btn-primary">
                <Icon name="plus" className="h-4 w-4" /> Start a test
              </Link>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/tests" className={chip(!statusFilter)}>
          All <span className={countPill(!statusFilter)}>{total}</span>
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/tests?status=${s}`} className={chip(statusFilter === s)}>
            <span className={`h-2 w-2 rounded-full ${statusFilter === s ? "bg-white" : DOT[s]}`} />
            {STATUS_LABEL[s]} <span className={countPill(statusFilter === s)}>{counts[s]}</span>
          </Link>
        ))}
      </div>

      <TestsTable
        available={statusFilter ? counts[statusFilter] : total}
        rows={tests.map((t) => ({
          id: t.id,
          patientName: t.patientName,
          patientMrn: t.patientMrn,
          testTypeName: t.testTypeName,
          status: t.status,
          collectionDate: t.collectionDate ? t.collectionDate.toISOString() : null,
        }))}
        emptyAction={
          canCreate ? (
            <Link href="/patients" title="Choose a patient, then start the test from their record" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> Start a breath test
            </Link>
          ) : undefined
        }
      />
    </AppShell>
  );
}
