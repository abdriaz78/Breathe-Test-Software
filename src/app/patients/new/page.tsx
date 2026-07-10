import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { PatientForm } from "@/components/PatientForm";

export default async function NewPatientPage() {
  const user = await requirePermission("patient:create");
  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Patients", href: "/patients" },
        { label: "Register" },
      ]}
    >
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Register patient</h1>
      <p className="mb-6 text-sm text-slate-500">
        Patient identifiers are encrypted at rest. Fields marked{" "}
        <span className="text-red-500">*</span> are required.
      </p>

      {hospitals.length === 0 ? (
        <div className="card max-w-2xl text-sm text-slate-600">
          No hospitals are configured yet. An administrator must add a hospital before
          patients can be registered.
        </div>
      ) : (
        <PatientForm hospitals={hospitals} />
      )}
    </AppShell>
  );
}
