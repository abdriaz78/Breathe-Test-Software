import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { listPatients } from "@/lib/patients";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { PatientsTable } from "@/components/ListTables";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/primitives";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ mrn?: string }>;
}) {
  const user = await requirePermission("patient:read");
  const { mrn } = await searchParams;
  const patients = await listPatients(user, { mrn });
  const canCreate = can(user.role, "patient:create");

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Patients" }]}>
      <PageHeader
        title="Patients"
        icon="users"
        description="Encrypted patient records for your hospital."
        actions={
          canCreate && (
            <Link href="/patients/new" className="btn-primary">
              <Icon name="userPlus" className="h-4 w-4" /> Register patient
            </Link>
          )
        }
      />

      {mrn && (
        <div className="mb-4 flex animate-fade-in-up flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-brand-900">
          <Icon name="filter" className="h-4 w-4 text-brand-600" />
          <span>
            Showing exact MRN match for <span className="font-mono font-semibold">{mrn}</span>
          </span>
          <Link href="/patients" className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">
            <Icon name="x" className="h-4 w-4" /> Clear
          </Link>
        </div>
      )}

      <PatientsTable
        rows={patients}
        emptyTitle={mrn ? "No patient found for that MRN" : undefined}
        emptyAction={
          mrn ? (
            <Link href="/patients" className="btn-secondary">Show all patients</Link>
          ) : canCreate ? (
            <Link href="/patients/new" className="btn-primary">
              <Icon name="userPlus" className="h-4 w-4" /> Register patient
            </Link>
          ) : undefined
        }
      />
    </AppShell>
  );
}
