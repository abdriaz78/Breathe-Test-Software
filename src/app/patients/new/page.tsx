import { requirePermission, hospitalScope } from "@/lib/session";
import { isHospitalScoped } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { PatientForm } from "@/components/PatientForm";

export default async function NewPatientPage() {
  const user = await requirePermission("patient:create");
  const scoped = isHospitalScoped(user.role);
  const [hospitals, physicians] = await Promise.all([
    prisma.hospital.findMany({
      where: scoped ? { id: user.hospitalId ?? "__no_hospital_assigned__", isActive: true } : { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: "PHYSICIAN", isActive: true, ...hospitalScope(user) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true },
    }),
  ]);

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
          {scoped
            ? "Your account has no hospital assigned yet. Ask an administrator to assign one before registering patients."
            : "No hospitals are configured yet. An administrator must add a hospital before patients can be registered."}
        </div>
      ) : (
        <PatientForm
          hospitals={hospitals}
          physicians={physicians}
          lockedHospitalId={scoped ? hospitals[0].id : undefined}
        />
      )}
    </AppShell>
  );
}
