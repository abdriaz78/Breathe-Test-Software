import Link from "next/link";
import { ROLE_LABELS } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";

interface Crumb {
  label: string;
  href?: string;
}

export function AppShell({
  user,
  breadcrumbs,
  children,
}: {
  user: CurrentUser;
  breadcrumbs?: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-clinical-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-sm font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              S
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-brand">
                QuinTron Breath Test
              </p>
              <p className="text-xs text-slate-500">Specter Clinical Platform</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl animate-fade-in px-6 py-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">/</span>}
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-brand">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-slate-700">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}
