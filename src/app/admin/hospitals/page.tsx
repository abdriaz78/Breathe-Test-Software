import { requirePermission } from "@/lib/session";
import { listHospitals } from "@/lib/admin-hospitals";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/primitives";
import { HospitalsAdmin, type AdminHospital } from "@/components/admin/HospitalsAdmin";

export default async function HospitalsAdminPage() {
  const user = await requirePermission("hospital:manage");
  const hospitals = await listHospitals(user);

  const rows: AdminHospital[] = hospitals.map((h) => ({
    id: h.id, name: h.name, code: h.code, city: h.city, country: h.country,
    logoUrl: h.logoUrl,
    patientCount: h._count.patients,
    userCount: h._count.users,
    departments: h.departments.map((d) => ({ id: d.id, name: d.name })),
  }));

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hospitals" }]}>
      <PageHeader
        icon="building"
        title={<>Hospitals &amp; departments</>}
        description={
          <>
            Manage hospitals and their departments.
          </>
        }
      />
      <HospitalsAdmin hospitals={rows} />
    </AppShell>
  );
}
