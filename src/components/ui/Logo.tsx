// Brand mark: a breath wave in a rounded gradient tile.
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`${className} relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 via-brand-600 to-accent-600 shadow-glow ring-1 ring-inset ring-white/20`}
    >
      <svg viewBox="0 0 32 32" className="h-[62%] w-[62%] text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
        <path d="M3 18c3 0 3-6 6-6s3 9 6 9 3-14 6-14 3 11 6 11" />
      </svg>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
    </div>
  );
}

export function LogoLockup({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <p className={`font-display text-[15px] font-bold ${tone === "light" ? "text-white" : "text-slate-900"}`}>
          QuinTron
        </p>
        <p className={`text-[11px] font-medium uppercase tracking-[0.14em] ${tone === "light" ? "text-brand-200/80" : "text-slate-500"}`}>
          Breath Test
        </p>
      </div>
    </div>
  );
}
