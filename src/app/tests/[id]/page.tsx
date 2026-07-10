import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, requestContext } from "@/lib/session";
import { getTestDetail, STATUS_LABEL, STATUS_STYLE } from "@/lib/tests";
import { getTestAuditTrail } from "@/lib/workflow";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { SampleReadout } from "@/components/SampleReadout";
import { BreathChart } from "@/components/BreathChart";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import { ShareButton } from "@/components/ShareButton";

function formatDateTime(d: Date | null | string): string {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatDate(d: Date | null | string): string {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Undisclosed",
};

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("test:read");
  const { id } = await params;
  const ctx = await requestContext();
  const test = await getTestDetail(user, id, ctx);
  if (!test) notFound();

  const showAudit = can(user.role, "audit:read");
  const auditTrail = showAudit ? await getTestAuditTrail(user, id) : [];

  const setupRows: Array<[string, string]> = [
    ["Test type", test.testType.name],
    ["Substrate", test.substrate || "—"],
    ["Dose", test.dose || "—"],
    ["Department", test.departmentName || "—"],
    ["Collection date", formatDate(test.collectionDate)],
    ["Analysis date", formatDate(test.analysisDate)],
    [
      "Technician",
      test.technician
        ? `${test.technician.title ? test.technician.title + " " : ""}${test.technician.name}`
        : "—",
    ],
    ["Created by", test.createdByName],
  ];

  const patientRows: Array<[string, string]> = [
    ["Name", test.patient.name],
    ["MRN", test.patient.mrn],
    ["Date of birth", formatDate(test.patient.dob)],
    ["Gender", GENDER_LABEL[test.patient.gender] ?? test.patient.gender],
    ["Weight", test.patient.weightKg != null ? `${test.patient.weightKg} kg` : "—"],
  ];

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Breath Tests", href: "/tests" },
        { label: test.testType.name },
      ]}
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{test.testType.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[test.status]}`}>
              {STATUS_LABEL[test.status]}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {test.patient.name}{" "}
            <span className="font-mono">(MRN {test.patient.mrn})</span>
          </p>
        </div>
        <div className="relative flex items-center gap-3">
          {can(user.role, "report:export") && (
            <>
              <a
                href={`/api/tests/${test.id}/report`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Download PDF
              </a>
              <a
                href={`/api/tests/${test.id}/samples.csv`}
                className="btn-secondary"
              >
                Export CSV
              </a>
            </>
          )}
          {can(user.role, "report:share") && (
            <ShareButton testId={test.id} patientMrn={test.patient.mrn} />
          )}
          <Link href={`/patients/${test.patient.id}`} className="btn-secondary">
            View patient
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Test setup
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {setupRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>

          {(test.preTestSymptoms || test.preTestNotes) && (
            <div className="mt-6 space-y-4 border-t border-clinical-border pt-4">
              {test.preTestSymptoms && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Pre-test symptoms
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">
                    {test.preTestSymptoms}
                  </dd>
                </div>
              )}
              {test.preTestNotes && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Pre-test notes
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">
                    {test.preTestNotes}
                  </dd>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Patient
          </h2>
          <dl className="space-y-3">
            {patientRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {test.samples.some((s) => !s.skipped) && (
        <section className="card mt-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Chart — H₂ / CH₄ / H₂+CH₄ over time
          </h2>
          <BreathChart
            samples={test.samples.map((s) => ({
              timeMinutes: s.timeMinutes,
              h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : null,
              ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : null,
              skipped: s.skipped,
            }))}
            h2RiseThreshold={
              (test.testType.interpretationRules as { h2RiseFromBaselinePpm?: number } | null)
                ?.h2RiseFromBaselinePpm ?? null
            }
          />
        </section>
      )}

      <section className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Samples
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{test.samples.length} sample(s)</span>
            {test.status !== "FINALIZED" && can(user.role, "test:update") && (
              <Link href={`/tests/${test.id}/samples`} className="btn-secondary">
                {test.samples.length ? "Edit samples" : "Enter samples"}
              </Link>
            )}
          </div>
        </div>
        <SampleReadout
          samples={test.samples.map((s) => ({
            sampleNumber: s.sampleNumber,
            timeMinutes: s.timeMinutes,
            h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : null,
            ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : null,
            co2Percent: s.co2Percent != null ? Number(s.co2Percent) : null,
            correctionFactor: s.correctionFactor != null ? Number(s.correctionFactor) : null,
            symptoms: s.symptoms,
            skipped: s.skipped,
            skippedReason: s.skippedReason,
          }))}
        />
      </section>

      <section className="card mt-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Diagnosis &amp; physician review
        </h2>
        <WorkflowPanel
          testId={test.id}
          status={test.status}
          diagnosis={test.diagnosis}
          recommendation={test.recommendation}
          hasSamples={test.samples.length > 0}
          canDiagnose={can(user.role, "test:diagnose")}
          canFinalize={can(user.role, "test:finalize")}
          canReopen={can(user.role, "test:reopen")}
          signatureName={test.signatureName}
          signedAt={test.signedAt ? formatDateTime(test.signedAt) : null}
        />
      </section>

      {showAudit && (
        <section className="card mt-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Audit trail
          </h2>
          {auditTrail.length === 0 ? (
            <p className="text-sm text-slate-400">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {auditTrail.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 whitespace-nowrap font-mono text-xs text-slate-400">
                    {formatDateTime(a.createdAt)}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {a.action}
                  </span>
                  <span className="text-slate-700">
                    {a.summary}
                    {a.actor?.name ? ` — ${a.actor.name}` : ""}
                    {a.reason ? (
                      <span className="mt-0.5 block text-xs italic text-amber-700">
                        Reason: {a.reason}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}
