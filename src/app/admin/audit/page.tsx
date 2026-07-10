import Link from "next/link";
import type { AuditAction } from "@prisma/client";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";

const ACTIONS: AuditAction[] = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "STATUS_CHANGE",
  "REOPEN", "FINALIZE", "SIGN", "EXPORT", "VIEW_PHI",
];

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string }>;
}) {
  const user = await requirePermission("audit:read");
  const { action, entity } = await searchParams;
  const actionFilter = ACTIONS.includes(action as AuditAction) ? (action as AuditAction) : undefined;

  const logs = await prisma.auditLog.findMany({
    where: { action: actionFilter, entity: entity || undefined },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Audit Log" }]}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Audit log</h1>
      <p className="mb-6 text-sm text-slate-500">
        Most recent {logs.length} event(s). PHI is never stored in audit records.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/audit"
          className={`rounded-md px-3 py-1.5 text-xs ${!actionFilter ? "bg-brand text-white" : "border border-clinical-border bg-white text-slate-600"}`}
        >
          All
        </Link>
        {ACTIONS.map((a) => (
          <Link
            key={a}
            href={`/admin/audit?action=${a}`}
            className={`rounded-md px-3 py-1.5 text-xs ${actionFilter === a ? "bg-brand text-white" : "border border-clinical-border bg-white text-slate-600"}`}
          >
            {a}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-clinical-border bg-white">
        <table className="min-w-full divide-y divide-clinical-border text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-border">
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit records.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                  {formatDateTime(l.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {l.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.entity}</td>
                <td className="px-4 py-3 text-slate-700">
                  {l.summary || "—"}
                  {l.reason && (
                    <span className="mt-0.5 block text-xs italic text-amber-700">Reason: {l.reason}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {l.actor?.name ?? "—"}
                  {l.ipAddress && <span className="block text-xs text-slate-400">{l.ipAddress}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
