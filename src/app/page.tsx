import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_LABELS, can, type Permission } from "@/lib/rbac";
import { SignOutButton } from "@/components/SignOutButton";

interface NavCard {
  title: string;
  description: string;
  href: string;
  permission: Permission;
}

const NAV_CARDS: NavCard[] = [
  { title: "Patients", description: "Register and manage patient records.", href: "/patients", permission: "patient:read" },
  { title: "Breath Tests", description: "Create tests, enter samples, view charts.", href: "/tests", permission: "test:read" },
  { title: "Reports", description: "Review, sign, and export PDF reports.", href: "/tests", permission: "report:export" },
  { title: "Test Types", description: "Manage the test-type catalog and thresholds.", href: "/admin/test-types", permission: "testtype:manage" },
  { title: "Hospitals", description: "Manage hospitals and departments.", href: "/admin/hospitals", permission: "hospital:manage" },
  { title: "Users", description: "Manage staff accounts and roles.", href: "/admin/users", permission: "user:manage" },
  { title: "Audit Log", description: "Review system and clinical activity.", href: "/admin/audit", permission: "audit:read" },
];

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const cards = NAV_CARDS.filter((c) => can(role, c.permission));

  return (
    <div className="min-h-screen">
      <header className="border-b border-clinical-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
              S
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">QuinTron Breath Test</p>
              <p className="text-xs text-slate-500">Specter Clinical Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="animate-fade-in-up">
          <h1 className="mb-1 text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mb-6 text-sm text-slate-500">
            Welcome back. Choose an area to get started.
          </p>
        </div>

        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="card card-interactive group"
            >
              <h2 className="mb-1 text-base font-semibold text-slate-900 transition-colors group-hover:text-brand">
                {card.title}
              </h2>
              <p className="text-sm text-slate-500">{card.description}</p>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
