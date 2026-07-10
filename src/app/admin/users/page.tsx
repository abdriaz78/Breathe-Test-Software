import { requirePermission } from "@/lib/session";
import { listUsers } from "@/lib/admin-users";
import { AppShell } from "@/components/AppShell";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

export default async function UsersAdminPage() {
  const user = await requirePermission("user:manage");
  const users = await listUsers(user);

  return (
    <AppShell
      user={user}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Users" }]}
    >
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">User management</h1>
      <p className="mb-6 text-sm text-slate-500">
        Create staff accounts, assign roles, and activate or deactivate access.
      </p>
      <UsersAdmin
        users={users.map((u) => ({
          id: u.id, email: u.email, name: u.name, role: u.role,
          title: u.title, isActive: u.isActive, lastLoginAt: u.lastLoginAt,
        }))}
        currentUserId={user.id}
      />
    </AppShell>
  );
}
