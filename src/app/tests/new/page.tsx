import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ROLE_LABELS } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { TestForm } from "@/components/TestForm";

export default async function NewTestPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const user = await requirePermission("test:create");
  const { patientId } = await searchParams;
  if (!patientId) notFound();

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, mrn: true, nameEnc: true, hospitalId: true },
  });
  if (!patient) notFound();

  const [testTypes, departments, technicians] = await Promise.all([
    prisma.testType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, defaultSubstrate: true, defaultDose: true },
    }),
    prisma.department.findMany({
      where: { hospitalId: patient.hospitalId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["NURSE", "PHYSICIAN", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, title: true },
    }),
  ]);

  const patientName = decrypt(patient.nameEnc) ?? "—";

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Patients", href: "/patients" },
        { label: patientName, href: `/patients/${patient.id}` },
        { label: "New test" },
      ]}
    >
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">New breath test</h1>
      <p className="mb-6 text-sm text-slate-500">
        The test starts as a <span className="font-medium">Draft</span>. You can enter
        samples after creating it.
      </p>

      <TestForm
        patient={{ id: patient.id, name: patientName, mrn: patient.mrn }}
        testTypes={testTypes}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        technicians={technicians.map((t) => ({
          id: t.id,
          label: `${t.title ? t.title + " " : ""}${t.name} — ${ROLE_LABELS[t.role]}`,
        }))}
      />
    </AppShell>
  );
}
