import Link from "next/link";
import type { ReactNode } from "react";
import type { ReportStatus } from "@prisma/client";
import { Icon, type IconName } from "./Icon";

// Small presentational building blocks shared by the pages.

export function PageHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in-up">
      <div className="flex items-start gap-4">
        {icon && (
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/60 sm:flex">
            <Icon name={icon} className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_META: Record<ReportStatus, { label: string; cls: string; dot: string }> = {
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500 animate-pulse" },
  FINALIZED: { label: "Finalized", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`badge ring-1 ring-inset ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const AVATAR_TONES = [
  "from-brand-400 to-brand-700",
  "from-sky-400 to-indigo-600",
  "from-violet-400 to-fuchsia-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
  "from-emerald-400 to-teal-700",
];

export function initials(name: string): string {
  const parts = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tone = AVATAR_TONES[h % AVATAR_TONES.length];
  const dims = size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm";
  return (
    <span className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tone} font-semibold text-white shadow-sm ring-2 ring-white`}>
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-brand-200/40 blur-xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-white text-brand-600 ring-1 ring-brand-100">
          <Icon name={icon} className="h-7 w-7" />
        </div>
      </div>
      <p className="font-display text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
  hint,
  href,
}: {
  label: string;
  value: number | string;
  icon: IconName;
  tone?: "brand" | "sky" | "amber" | "emerald" | "violet";
  hint?: string;
  href?: string;
}) {
  const tones = {
    brand: "from-brand-500 to-brand-700 shadow-brand-500/30",
    sky: "from-sky-400 to-blue-600 shadow-sky-500/30",
    amber: "from-amber-400 to-orange-500 shadow-amber-500/30",
    emerald: "from-emerald-400 to-emerald-600 shadow-emerald-500/30",
    violet: "from-violet-400 to-indigo-600 shadow-violet-500/30",
  }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tones} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card card-interactive group block p-5">{body}</Link>
  ) : (
    <div className="card group p-5">{body}</div>
  );
}
