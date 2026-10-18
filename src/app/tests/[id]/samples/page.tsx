import { notFound, redirect } from "next/navigation";
import { requirePermission, requestContext } from "@/lib/session";
import { getTestDetail } from "@/lib/tests";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/primitives";
import { SampleTable, type EditableRow } from "@/components/SampleTable";

export default async function EditSamplesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("test:update");
  const { id } = await params;
  const ctx = await requestContext();
  const test = await getTestDetail(user, id, ctx);
  if (!test) notFound();

  // Finalized reports are locked — send the user back to the read-only view.
  if (test.status === "FINALIZED") redirect(`/tests/${id}`);

  const initialRows: EditableRow[] = test.samples.map((s) => ({
    sampleNumber: s.sampleNumber,
    timeMinutes: s.timeMinutes,
    clockTime: s.clockTime ?? "",
    h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : "",
    ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : "",
    co2Percent: s.co2Percent != null ? Number(s.co2Percent) : "",
    correctionFactor: s.correctionFactor != null ? Number(s.correctionFactor) : "",
    symptoms: s.symptoms ?? "",
    skipped: s.skipped,
    skippedReason: s.skippedReason ?? "",
  }));

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Breath Tests", href: "/tests" },
        { label: test.testType.name, href: `/tests/${id}` },
        { label: "Samples" },
      ]}
    >
      <PageHeader
        icon="activity"
        title={<>Sample entry</>}
        description={
          <>
            {test.patient.name} <span className="font-mono">(MRN {test.patient.mrn})</span> —{" "}
        {test.testType.name}. H₂+CH₄ is calculated automatically.
          </>
        }
      />

      <SampleTable
        testId={id}
        initialRows={initialRows}
        h2RiseThreshold={
          (test.testType.interpretationRules as { h2RiseFromBaselinePpm?: number } | null)
            ?.h2RiseFromBaselinePpm ?? null
        }
      />
    </AppShell>
  );
}
