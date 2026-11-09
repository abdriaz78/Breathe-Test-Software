import { requirePatient } from "@/lib/session";
import { getOwnProfile, listOwnReports } from "@/lib/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function PortalHomePage() {
  const me = await requirePatient();
  const [profile, reports] = await Promise.all([getOwnProfile(me), listOwnReports(me)]);

  return (
    <PortalShell hospitalName={profile?.hospitalName}>
      <section className="card relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-brand-500 to-brand-700" />
        <p className="text-sm text-slate-500">Welcome</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">{profile?.name ?? "Patient"}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">MRN {profile?.mrn}</span>
          {profile?.hospitalName && (
            <span>
              {profile.hospitalName}
              {profile.hospitalCity ? `, ${profile.hospitalCity}` : ""}
            </span>
          )}
        </p>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">Your breath test reports</h2>
          <span className="text-sm text-slate-500">{reports.length} report(s)</span>
        </div>

        {reports.length === 0 ? (
          <div className="card text-center">
            <Icon name="inbox" className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">No reports yet</p>
            <p className="mt-1 text-sm text-slate-500">Your report appears here once your hospital has completed it.</p>
          </div>
        ) : (
          <ul className="space-y-3" data-testid="portal-reports">
            {reports.map((r) => (
              <li key={r.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{r.testTypeName}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Test date {formatDate(r.collectionDate)} · Completed {formatDate(r.finalizedAt)}
                  </p>
                </div>
                <a href={`/api/portal/reports/${r.id}`} target="_blank" rel="noopener" className="btn-primary justify-center">
                  <Icon name="download" className="h-4 w-4" /> View PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
        <a href="/portal/change-password" className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-brand-700">
          <Icon name="lock" className="h-4 w-4" /> Change password
        </a>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Icon name="shield" className="h-3.5 w-3.5" /> Please discuss your results with your doctor.
        </p>
      </div>
    </PortalShell>
  );
}
