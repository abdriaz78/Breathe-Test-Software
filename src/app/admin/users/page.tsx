import { requirePermission } from "@/lib/session";
import { listUsers } from "@/lib/admin-users";
import { listHospitals } from "@/lib/admin-hospitals";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/primitives";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

export default async function UsersAdminPage() {
  const user = await requirePermission("user:manage");
  const [users, hospitals] = await Promise.all([listUsers(user), listHospitals(user)]);

  return (
    <AppShell
      user={user}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Users" }]}
    >
      <PageHeader
        icon="shield"
        title={<>User management</>}
        description={
          <>
            Create staff accounts, assign roles, and activate or deactivate access.
          </>
        }
      />
      <UsersAdmin
        users={users.map((u) => ({
          id: u.id, email: u.email, name: u.name, role: u.role,
          title: u.title, isActive: u.isActive, lastLoginAt: u.lastLoginAt,
          hospitalId: u.hospitalId, hospitalName: u.hospital?.name ?? null,
        }))}
        hospitals={hospitals.map((h) => ({ id: h.id, name: h.name }))}
        currentUserId={user.id}
      />
    </AppShell>
  );
}
