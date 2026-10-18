import { LogoLockup } from "./Logo";

// Placeholder shown while a page's data loads (see app/loading.tsx). It mirrors
// the AppShell frame — dark sidebar, glass top bar — so navigating between
// pages never flashes an empty screen.

function Bar({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg bg-slate-200/70 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-gradient-to-b from-ink-900 via-ink-900 to-ink-950 lg:block">
        <div className="flex h-16 items-center px-5">
          <LogoLockup tone="light" />
        </div>
        <div className="space-y-3 px-6 py-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-white/[0.06]" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          ))}
        </div>
      </aside>

      <div className="lg:pl-64">
        <div className="sticky top-0 z-20 h-16 border-b border-slate-200/70 bg-white/60 backdrop-blur-xl" />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Bar className="mb-6 h-4 w-40" />
          <div className="mb-8 flex items-center gap-4">
            <Bar className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Bar className="h-7 w-56" />
              <Bar className="h-4 w-72" />
            </div>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card space-y-4 p-5">
                <Bar className="h-4 w-24" />
                <Bar className="h-8 w-16" />
              </div>
            ))}
          </div>
          <div className="table-shell">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-slate-100 px-5 py-4 first:border-t-0">
                <Bar className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bar className="h-4 w-1/3" />
                  <Bar className="h-3 w-1/5" />
                </div>
                <Bar className="hidden h-6 w-20 rounded-full sm:block" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
