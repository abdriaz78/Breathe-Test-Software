import { requirePermission } from "@/lib/session";
import { listHospitals } from "@/lib/admin-hospitals";
import { AppShell } from "@/components/AppShell";
import { HospitalsAdmin, type AdminHospital } from "@/components/admin/HospitalsAdmin";

export default async function HospitalsAdminPage() {
  const user = await requirePermission("hospital:manage");
  const hospitals = await listHospitals(user);

  const rows: AdminHospital[] = hospitals.map((h) => ({
    id: h.id, name: h.name, code: h.code, city: h.city, country: h.country,
    logoUrl: h.logoUrl,
    patientCount: h._count.patients,
    departments: h.departments.map((d) => ({ id: d.id, name: d.name })),
  }));

  return (
    <AppShell user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hospitals" }]}>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Hospitals &amp; departments</h1>
      <p className="mb-6 text-sm text-slate-500">Manage hospitals and their departments.</p>
      <HospitalsAdmin hospitals={rows} />
    </AppShell>
  );
}
