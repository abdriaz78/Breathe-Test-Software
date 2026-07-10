import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { listPatients } from "@/lib/patients";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Undisclosed",
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ mrn?: string }>;
}) {
  const user = await requirePermission("patient:read");
  const { mrn } = await searchParams;
  const patients = await listPatients(user, { mrn });

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Patients" }]}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500">{patients.length} record(s)</p>
        </div>
        {can(user.role, "patient:create") && (
          <Link href="/patients/new" className="btn-primary">
            Register patient
          </Link>
        )}
      </div>

      <form className="mb-4 flex gap-2" action="/patients" method="get">
        <input
          type="text"
          name="mrn"
          defaultValue={mrn ?? ""}
          placeholder="Search by exact MRN…"
          className="input max-w-xs"
        />
        <button className="btn-secondary" type="submit">
          Search
        </button>
        {mrn && (
          <Link href="/patients" className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-clinical-border bg-white">
        <table className="min-w-full divide-y divide-clinical-border text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">MRN</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Hospital</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-border">
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {mrn ? "No patient found for that MRN." : "No patients registered yet."}
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr key={p.id} className="transition-colors duration-150 hover:bg-brand/5">
                <td className="px-4 py-3 font-mono text-slate-700">{p.mrn}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                <td className="px-4 py-3 text-slate-600">{GENDER_LABEL[p.gender] ?? p.gender}</td>
                <td className="px-4 py-3 text-slate-600">{p.hospitalName}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/patients/${p.id}`} className="text-brand hover:underline">
                    View
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
