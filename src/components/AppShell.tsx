import Link from "next/link";
import { can, ROLE_LABELS, type Permission } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HeaderTimers } from "./HeaderTimers";
import { DueBanner } from "./DueBanner";
import { ShellFrame, type NavItem } from "./ShellFrame";
import { Icon } from "./ui/Icon";

interface Crumb {
  label: string;
  href?: string;
}

const NAV: Array<NavItem & { permission?: Permission }> = [
  { label: "Dashboard", href: "/", icon: "home", section: "main" },
  { label: "Patients", href: "/patients", icon: "users", section: "main", permission: "patient:read" },
  { label: "Breath Tests", href: "/tests", icon: "flask", section: "main", permission: "test:read" },
  { label: "Test Types", href: "/admin/test-types", icon: "layers", section: "admin", permission: "testtype:manage" },
  { label: "Hospitals", href: "/admin/hospitals", icon: "building", section: "admin", permission: "hospital:manage" },
  { label: "Users", href: "/admin/users", icon: "shield", section: "admin", permission: "user:manage" },
  { label: "Audit Log", href: "/admin/audit", icon: "history", section: "admin", permission: "audit:read" },
];

export async function AppShell({
  user,
  breadcrumbs,
  children,
}: {
  user: CurrentUser;
  breadcrumbs?: Crumb[];
  children: React.ReactNode;
}) {
  const canManageTimers = can(user.role, "test:timer");
  const nav: NavItem[] = NAV.filter((n) => !n.permission || can(user.role, n.permission)).map((n) => ({
    label: n.label,
    href: n.href,
    icon: n.icon,
    section: n.section,
  }));
  const hospital = user.hospitalId
    ? await prisma.hospital.findUnique({ where: { id: user.hospitalId }, select: { name: true } })
    : null;

  return (
    <ShellFrame
      nav={nav}
      userName={user.name}
      roleLabel={ROLE_LABELS[user.role]}
      hospitalLabel={hospital?.name ?? (user.hospitalId ? null : "All hospitals")}
      topRight={<HeaderTimers canManageTimers={canManageTimers} />}
      banner={<DueBanner canManageTimers={canManageTimers} />}
    >
      <div className="animate-fade-in">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-slate-500" aria-label="Breadcrumb">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-slate-300" />}
                {c.href ? (
                  <Link href={c.href} className="inline-flex items-center gap-1 rounded-md px-1 transition-colors hover:text-brand-700">
                    {i === 0 && c.label === "Home" && <Icon name="home" className="h-3.5 w-3.5" />}
                    {c.label}
                  </Link>
                ) : (
                  <span className="px-1 font-medium text-slate-800">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {children}
      </div>
    </ShellFrame>
  );
}
