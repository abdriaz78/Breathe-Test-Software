import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { listPatientsPage } from "@/lib/patients";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { PatientsTable } from "@/components/ListTables";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/primitives";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mrn?: string; page?: string }>;
}) {
  const user = await requirePermission("patient:read");
  const { q, mrn, page } = await searchParams;
  // `mrn` is the old exact-lookup parameter; it now feeds the general search.
  const result = await listPatientsPage(user, { q: q ?? mrn, page: parsePage(page) });
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

      <PatientsTable
        rows={result.rows}
        info={result}
        emptyAction={
          canCreate ? (
            <Link href="/patients/new" className="btn-primary">
              <Icon name="userPlus" className="h-4 w-4" /> Register patient
            </Link>
          ) : undefined
        }
      />
    </AppShell>
  );
}
