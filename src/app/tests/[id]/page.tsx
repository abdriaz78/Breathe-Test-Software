import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, requestContext } from "@/lib/session";
import { getTestDetail } from "@/lib/tests";
import { getTestAuditTrail } from "@/lib/workflow";
import { summarizeResult, summarizeCh4Result, type InterpretationRules } from "@/lib/interpretation";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { SampleReadout } from "@/components/SampleReadout";
import { BreathChart } from "@/components/BreathChart";
import { CH4_TRIGGER_PPM } from "@/lib/chart-geometry";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import { TimerPanel } from "@/components/TimerPanel";
import { receivesReminders } from "@/lib/timers";
import { ShareButton } from "@/components/ShareButton";
import { Icon } from "@/components/ui/Icon";
import { Avatar, StatusBadge } from "@/components/ui/primitives";

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

  const resultSummary = summarizeResult(
    test.samples.map((s) => ({
      timeMinutes: s.timeMinutes,
      h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : null,
      ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : null,
      skipped: s.skipped,
    })),
    test.testType.interpretationRules as InterpretationRules | null
  );
  const ch4Result = summarizeCh4Result(
    test.samples.map((s) => ({
      timeMinutes: s.timeMinutes,
      h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : null,
      ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : null,
      skipped: s.skipped,
    })),
    CH4_TRIGGER_PPM
  );

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
      <section className="card relative mb-6 overflow-visible p-0 animate-fade-in-up">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 via-brand-600 to-accent-500" />
        </div>
        <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={test.patient.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{test.testType.name}</h1>
                <StatusBadge status={test.status} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <Link href={`/patients/${test.patient.id}`} className="font-semibold text-slate-800 transition-colors hover:text-brand-700">
                  {test.patient.name}
                </Link>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">MRN {test.patient.mrn}</span>
              </p>
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            {can(user.role, "report:export") && (
              <>
                <a
                  href={`/api/tests/${test.id}/report`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  <Icon name="fileText" className="h-4 w-4" /> Download PDF
                </a>
                <a href={`/api/tests/${test.id}/samples.csv`} className="btn-secondary">
                  <Icon name="download" className="h-4 w-4" /> Export CSV
                </a>
              </>
            )}
            {can(user.role, "report:share") && (
              <ShareButton testId={test.id} patientMrn={test.patient.mrn} />
            )}
            <Link href={`/patients/${test.patient.id}`} className="btn-secondary">
              <Icon name="users" className="h-4 w-4" /> View patient
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-semibold text-slate-900">
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
          <h2 className="mb-4 font-display text-base font-semibold text-slate-900">
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

      {(resultSummary || ch4Result) && (
        <section className="card mt-6">
          <h2 className="mb-2 font-display text-base font-semibold text-slate-900">
            Test result
          </h2>
          {resultSummary && (
            <>
              <p
                className={`text-base font-semibold ${
                  resultSummary.anyMet ? "text-amber-700" : "text-slate-900"
                }`}
              >
                {resultSummary.verdict} {(test.substrate || test.testType.name).toLowerCase()} breath
                test result.
              </p>
              <p className="mt-1 text-sm text-slate-500">{resultSummary.statsLine}</p>
            </>
          )}
          {ch4Result && (
            <>
              <p
                className={`text-base font-semibold ${resultSummary ? "mt-3" : ""} ${
                  ch4Result.anyMet ? "text-amber-700" : "text-slate-900"
                }`}
              >
                {ch4Result.verdict} (Intestinal Methanogen Overgrowth).
              </p>
              <p className="mt-1 text-sm text-slate-500">{ch4Result.statsLine}</p>
            </>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Automated threshold support only — not a diagnosis. Final interpretation is
            the reviewing physician&apos;s.
          </p>
        </section>
      )}

      {test.samples.some((s) => !s.skipped) && (() => {
        const chartSamples = test.samples.map((s) => ({
          sampleNumber: s.sampleNumber,
          timeMinutes: s.timeMinutes,
          h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : null,
          ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : null,
          skipped: s.skipped,
        }));
        const h2Threshold =
          (test.testType.interpretationRules as { h2RiseFromBaselinePpm?: number } | null)
            ?.h2RiseFromBaselinePpm ?? null;
        return (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="mb-4 font-display text-base font-semibold text-slate-900">
                H₂ over time
              </h2>
              <BreathChart samples={chartSamples} series={["h2"]} h2RiseThreshold={h2Threshold} />
            </section>
            <section className="card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  CH₄ over time
                </h2>
                {ch4Result && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ch4Result.anyMet ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ch4Result.verdict}
                  </span>
                )}
              </div>
              <BreathChart samples={chartSamples} series={["ch4"]} ch4Threshold={CH4_TRIGGER_PPM} />
            </section>
          </div>
        );
      })()}

      {test.status !== "FINALIZED" && (
        <section className="card mt-6">
          <h2 className="mb-4 font-display text-base font-semibold text-slate-900">
            Sample collection timer
          </h2>
          <TimerPanel
            testId={test.id}
            canManage={can(user.role, "test:timer")}
            canDelete={can(user.role, "timer:delete")}
            showReminders={receivesReminders(user, test.createdById)}
            ownerName={test.createdByName}
            timer={{
              startedAt: test.timer.startedAt?.toISOString() ?? null,
              intervalMinutes: test.timer.intervalMinutes,
              totalSamples: test.timer.totalSamples,
              ackedIndex: test.timer.ackedIndex,
              endedAt: test.timer.endedAt?.toISOString() ?? null,
            }}
          />
        </section>
      )}

      <section className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
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
            clockTime: s.clockTime,
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
        <h2 className="mb-4 font-display text-base font-semibold text-slate-900">
          Diagnosis &amp; physician review
        </h2>
        <WorkflowPanel
          testId={test.id}
          status={test.status}
          diagnosis={test.diagnosis}
          recommendation={test.recommendation}
          canDiagnose={can(user.role, "test:diagnose")}
        />
      </section>

      {showAudit && (
        <section className="card mt-6">
          <h2 className="mb-4 font-display text-base font-semibold text-slate-900">
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
