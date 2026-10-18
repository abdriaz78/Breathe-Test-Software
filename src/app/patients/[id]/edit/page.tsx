import { notFound } from "next/navigation";
import { requirePermission, requestContext, hospitalScope } from "@/lib/session";
import { isHospitalScoped } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPatient } from "@/lib/patients";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/primitives";
import { PatientForm } from "@/components/PatientForm";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("patient:update");
  const { id } = await params;
  const ctx = await requestContext();
  const patient = await getPatient(user, id, ctx);
  if (!patient) notFound();

  const scoped = isHospitalScoped(user.role);
  const [hospitals, physicians, finalizedCount] = await Promise.all([
    prisma.hospital.findMany({
      // Always include the patient's current hospital, even if since deactivated.
      where: scoped
        ? { id: user.hospitalId ?? "__no_hospital_assigned__" }
        : { OR: [{ isActive: true }, { id: patient.hospitalId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: "PHYSICIAN", isActive: true, ...hospitalScope(user) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true },
    }),
    prisma.breathTest.count({ where: { patientId: id, status: "FINALIZED" } }),
  ]);

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Patients", href: "/patients" },
        { label: patient.name, href: `/patients/${patient.id}` },
        { label: "Edit" },
      ]}
    >
      <PageHeader
        icon="pencil"
        title={<>Edit patient details</>}
        description={
          <>
            Correct any details entered wrongly at registration. Every change is recorded in the
        audit trail.
          </>
        }
      />

      {finalizedCount > 0 && (
        <div className="mb-6 max-w-2xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This patient has {finalizedCount} finalized report(s). Corrected details will also
          appear on those reports when they are next viewed or downloaded.
        </div>
      )}

      <PatientForm
        hospitals={hospitals}
        physicians={physicians}
        lockedHospitalId={scoped ? patient.hospitalId : undefined}
        patient={{
          id: patient.id,
          mrn: patient.mrn,
          name: patient.name,
          dob: patient.dob,
          gender: patient.gender,
          weightKg: patient.weightKg,
          hospitalId: patient.hospitalId,
          referringPhysician: patient.referringPhysician,
        }}
      />
    </AppShell>
  );
}
