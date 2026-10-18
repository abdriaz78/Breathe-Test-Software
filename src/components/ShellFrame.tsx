"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/primitives";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  section: "main" | "admin";
}

// Client chrome around every signed-in page: dark sidebar (drawer on mobile),
// sticky glass top bar, user menu. Page content arrives as server-rendered
// children, and `topRight` carries the live timer widget.
export function ShellFrame({
  nav,
  userName,
  roleLabel,
  hospitalLabel,
  topRight,
  banner,
  children,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  hospitalLabel?: string | null;
  topRight?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawer(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const sidebar = (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-ink-900 via-ink-900 to-ink-950 text-slate-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(400px_200px_at_0%_0%,rgba(20,184,166,0.25),transparent)]" />
      <div className="relative flex h-16 items-center px-5">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <LogoLockup tone="light" />
        </Link>
      </div>

      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {(["main", "admin"] as const).map((section) => {
          const items = nav.filter((n) => n.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {section === "main" ? "Workspace" : "Administration"}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-r from-brand-500/25 to-brand-500/5 text-white shadow-inner-line"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-400 shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
                        )}
                        <Icon
                          name={item.icon}
                          className={`h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 ${active ? "text-brand-300" : ""}`}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="relative m-3 rounded-2xl border border-white/5 bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <Avatar name={userName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="truncate text-xs text-slate-400">{roleLabel}</p>
          </div>
        </div>
        {hospitalLabel && (
          <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-slate-500">
            <Icon name="building" className="h-3.5 w-3.5" /> {hospitalLabel}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] animate-slide-in-left overflow-hidden shadow-2xl">
            {sidebar}
            <button
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <Icon name="x" />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button onClick={() => setDrawer(true)} className="btn-ghost -ml-2 px-2 lg:hidden" aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <div className="lg:hidden">
              <LogoLockup />
            </div>
            <div className="flex-1" />
            {topRight}
            <UserMenu userName={userName} roleLabel={roleLabel} />
          </div>
        </header>

        {banner}

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={userName} size="sm" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-semibold text-slate-900">{userName}</span>
          <span className="block text-xs text-slate-500">{roleLabel}</span>
        </span>
        <Icon
          name="chevronDown"
          className={`hidden h-4 w-4 text-slate-400 transition-transform md:block ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-lift"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-500">{roleLabel}</p>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <Icon name="logOut" className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
