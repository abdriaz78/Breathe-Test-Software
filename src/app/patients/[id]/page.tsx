import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, requestContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getPatient, ageOf } from "@/lib/patients";
import { listTests, STATUS_LABEL, STATUS_STYLE } from "@/lib/tests";
import { AppShell } from "@/components/AppShell";

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{patient.name}</h1>
          <p className="font-mono text-sm text-slate-500">MRN {patient.mrn}</p>
        </div>
        {can(user.role, "test:create") && (
          <Link href={`/tests/new?patientId=${patient.id}`} className="btn-primary">
            New breath test
          </Link>
        )}
      </div>

      <div className="card max-w-3xl">
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
        <section className="mt-6 max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Reports
            </h2>
            <span className="text-sm text-slate-500">{reports.length} report(s)</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-clinical-border bg-white">
            <table className="min-w-full divide-y divide-clinical-border text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
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
                  <tr key={t.id} className="transition-colors duration-150 hover:bg-brand/5">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.testTypeName}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.collectionDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.createdAt)}</td>
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
        </section>
      )}

      <p className="mt-4 max-w-3xl text-xs text-slate-400">
        Accessing this record was logged to the audit trail.
      </p>
    </AppShell>
  );
}
