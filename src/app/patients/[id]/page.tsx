import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, requestContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getPatient, ageOf } from "@/lib/patients";
import { listTests, STATUS_LABEL, STATUS_STYLE } from "@/lib/tests";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/primitives";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Undisclosed",
};

function formatDate(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("patient:read");
  const { id } = await params;
  const ctx = await requestContext();
  const patient = await getPatient(user, id, ctx);
  if (!patient) notFound();

  const showReports = can(user.role, "test:read");
  const reports = showReports ? await listTests(user, { patientId: id }) : [];

  const age = ageOf(patient.dob);

  const rows: Array<[string, string]> = [
    ["MRN / Patient ID", patient.mrn],
    ["Full name", patient.name],
    ["Date of birth", `${formatDate(patient.dob)}${age != null ? ` (${age} yrs)` : ""}`],
    ["Gender", GENDER_LABEL[patient.gender] ?? patient.gender],
    ["Weight", patient.weightKg != null ? `${patient.weightKg} kg` : "—"],
    ["Hospital", patient.hospitalName],
    ["Referring physician", patient.referringPhysician || "—"],
    ["Registered", formatDate(patient.createdAt.toISOString())],
  ];

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Patients", href: "/patients" },
        { label: patient.name },
      ]}
    >
      <section className="card relative mb-6 max-w-4xl overflow-hidden p-0 animate-fade-in-up">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-brand-500 to-brand-700" />
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={patient.name} size="lg" />
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{patient.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">MRN {patient.mrn}</span>
                {age != null && <span>{age} yrs</span>}
                <span className="text-slate-300">•</span>
                <span>{GENDER_LABEL[patient.gender] ?? patient.gender}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can(user.role, "patient:update") && (
              <Link href={`/patients/${patient.id}/edit`} className="btn-secondary">
                <Icon name="pencil" className="h-4 w-4" /> Edit details
              </Link>
            )}
            {can(user.role, "test:create") && (
              <Link href={`/tests/new?patientId=${patient.id}`} className="btn-primary">
                <Icon name="plus" className="h-4 w-4" /> New breath test
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="card max-w-4xl">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {label}
              </dt>
              <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {showReports && (
        <section className="mt-6 max-w-4xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Reports
            </h2>
            <span className="text-sm text-slate-500">{reports.length} report(s)</span>
          </div>
          <div className="table-shell">
            <table className="min-w-full divide-y divide-clinical-border text-sm">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Test type</th>
                  <th className="px-4 py-3">Collection</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-border">
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No reports for this patient yet.
                    </td>
                  </tr>
                )}
                {reports.map((t) => (
                  <tr key={t.id} className="transition-colors duration-150 hover:bg-brand-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.testTypeName}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.collectionDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/tests/${t.id}`} className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-4 flex max-w-4xl items-center gap-1.5 text-xs text-slate-400">
        <Icon name="shield" className="h-3.5 w-3.5" />
        Accessing this record was logged to the audit trail.
      </p>
    </AppShell>
  );
}
