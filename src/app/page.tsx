import Link from "next/link";
import { requireUser } from "@/lib/session";
import { can, type Permission } from "@/lib/rbac";
import { getDashboardStats } from "@/lib/dashboard";
import { AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BreathWaves } from "@/components/ui/BreathWaves";
import { Greeting } from "@/components/ui/Greeting";
import { Avatar, EmptyState, StatCard, StatusBadge } from "@/components/ui/primitives";

interface Shortcut {
  title: string;
  description: string;
  href: string;
  icon: IconName;
  permission: Permission;
  tone: string;
}

const SHORTCUTS: Shortcut[] = [
  { title: "Patients", description: "Register and manage patient records.", href: "/patients", icon: "users", permission: "patient:read", tone: "from-sky-400 to-blue-600" },
  { title: "Breath Tests", description: "Create tests, enter samples, view charts.", href: "/tests", icon: "flask", permission: "test:read", tone: "from-brand-400 to-brand-700" },
  { title: "Reports", description: "Review, sign, and export PDF reports.", href: "/tests?status=FINALIZED", icon: "fileText", permission: "report:export", tone: "from-emerald-400 to-emerald-600" },
  { title: "Test Types", description: "Manage the test-type catalog and thresholds.", href: "/admin/test-types", icon: "layers", permission: "testtype:manage", tone: "from-violet-400 to-indigo-600" },
  { title: "Hospitals", description: "Manage hospitals and departments.", href: "/admin/hospitals", icon: "building", permission: "hospital:manage", tone: "from-amber-400 to-orange-500" },
  { title: "Users", description: "Manage staff accounts and roles.", href: "/admin/users", icon: "shield", permission: "user:manage", tone: "from-rose-400 to-pink-600" },
  { title: "Audit Log", description: "Review system and clinical activity.", href: "/admin/audit", icon: "history", permission: "audit:read", tone: "from-slate-500 to-slate-700" },
];

function timeAgo(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function HomePage() {
  const user = await requireUser();
  const stats = await getDashboardStats(user);
  const shortcuts = SHORTCUTS.filter((c) => can(user.role, c.permission));
  const canCreatePatient = can(user.role, "patient:create");
  const canCreateTest = can(user.role, "test:create");

  const t = stats.tests;
  const statCount = (stats.patients !== null ? 1 : 0) + (t ? 3 : 0) + (stats.admin ? 2 : 0);
  const pct = (n: number) => (t && t.total > 0 ? Math.round((n / t.total) * 100) : 0);

  return (
    <AppShell user={user}>
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 px-6 py-8 shadow-lift sm:px-10 sm:py-10 animate-fade-in-up">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-accent-400/30 blur-3xl" />
        <BreathWaves className="h-28 text-white" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <Greeting name={user.name} />
            <p className="mt-3 text-sm leading-relaxed text-brand-50/85 sm:text-base">
              {t && t.byStatus.IN_PROGRESS > 0
                ? `${t.byStatus.IN_PROGRESS} breath test${t.byStatus.IN_PROGRESS === 1 ? " is" : "s are"} in progress right now.`
                : "Everything is up to date. Here is your clinical overview for today."}
            </p>
          </div>
          {(canCreatePatient || canCreateTest) && (
            <div className="flex flex-wrap gap-3">
              {canCreatePatient && (
                <Link
                  href="/patients/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
                >
                  <Icon name="userPlus" className="h-4 w-4" /> Register patient
                </Link>
              )}
              {canCreateTest && (
                <Link
                  href="/patients" title="Choose a patient, then start the test from their record"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/25 active:translate-y-0"
                >
                  <Icon name="plus" className="h-4 w-4" /> Start a breath test
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <div className={`stagger-children mb-8 grid grid-cols-2 gap-3 sm:gap-4 ${statCount % 3 === 0 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        {stats.patients !== null && (
          <StatCard label="Patients" value={stats.patients} icon="users" tone="sky" hint="Registered records" href="/patients" />
        )}
        {t && (
          <>
            <StatCard label="Breath tests" value={t.total} icon="flask" tone="brand" hint={`${t.lastWeek} created in the last 7 days`} href="/tests" />
            <StatCard label="In progress" value={t.byStatus.IN_PROGRESS} icon="activity" tone="amber" hint="Collecting samples" href="/tests?status=IN_PROGRESS" />
            <StatCard label="Finalized reports" value={t.byStatus.FINALIZED} icon="checkCircle" tone="emerald" hint="Signed & locked" href="/tests?status=FINALIZED" />
          </>
        )}
        {stats.admin && (
          <>
            <StatCard label="Hospitals" value={stats.admin.hospitals} icon="building" tone="violet" hint="Across the platform" href="/admin/hospitals" />
            <StatCard label="Active staff" value={stats.admin.activeUsers} icon="shield" tone="brand" hint="Accounts that can sign in" href="/admin/users" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent tests */}
        {t && (
          <section className="card p-0 xl:col-span-2 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">Recent breath tests</h2>
                <p className="text-xs text-slate-500">The latest activity in your workspace</p>
              </div>
              <Link href="/tests" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
                View all <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            {stats.recentTests.length === 0 ? (
              <EmptyState
                icon="flask"
                title="No breath tests yet"
                description="Tests you create will appear here with their live status."
                action={canCreateTest ? <Link href="/patients" title="Choose a patient, then start the test from their record" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Start a breath test</Link> : undefined}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.recentTests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/tests/${r.id}`} className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-brand-50/50">
                      <Avatar name={r.patientName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{r.patientName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {r.testTypeName} · <span className="font-mono">{r.patientMrn}</span>
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <StatusBadge status={r.status} />
                        <p className="mt-1 text-[11px] text-slate-400">{timeAgo(r.createdAt)}</p>
                      </div>
                      <Icon name="chevronRight" className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Status breakdown */}
        {t && (
          <section className="card self-start animate-fade-in-up">
            <h2 className="font-display text-base font-semibold text-slate-900">Pipeline</h2>
            <p className="mb-5 text-xs text-slate-500">Where every breath test currently stands</p>
            <div className="mb-6 flex h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="bg-slate-400 transition-all duration-700" style={{ width: `${pct(t.byStatus.DRAFT)}%` }} />
              <div className="bg-amber-400 transition-all duration-700" style={{ width: `${pct(t.byStatus.IN_PROGRESS)}%` }} />
              <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${pct(t.byStatus.FINALIZED)}%` }} />
            </div>
            <ul className="space-y-3">
              {([
                ["Draft", t.byStatus.DRAFT, "bg-slate-400", "DRAFT"],
                ["In progress", t.byStatus.IN_PROGRESS, "bg-amber-400", "IN_PROGRESS"],
                ["Finalized", t.byStatus.FINALIZED, "bg-emerald-500", "FINALIZED"],
              ] as const).map(([label, n, dot, key]) => (
                <li key={key}>
                  <Link href={`/tests?status=${key}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
                    <span className="flex items-center gap-2.5 text-sm text-slate-700">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      {label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {n} <span className="ml-1 text-xs font-normal text-slate-400">{pct(n)}%</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Shortcuts */}
      <section className="mt-8">
        <h2 className="section-title mb-4"><Icon name="sparkles" className="h-4 w-4 text-brand-600" /> Quick access</h2>
        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shortcuts.map((c) => (
            <Link key={c.title} href={c.href} className="card card-interactive group flex items-start gap-4 p-5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.tone} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                <Icon name={c.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-display text-sm font-semibold text-slate-900 transition-colors group-hover:text-brand-700">
                  {c.title}
                  <Icon name="arrowRight" className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{c.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
