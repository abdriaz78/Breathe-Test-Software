import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, requestContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getPatient, ageOf } from "@/lib/patients";
import { AppShell } from "@/components/AppShell";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Undisclosed",
};

function formatDate(iso: string): string {
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

      <p className="mt-4 max-w-3xl text-xs text-slate-400">
        Accessing this record was logged to the audit trail.
      </p>
    </AppShell>
  );
}
