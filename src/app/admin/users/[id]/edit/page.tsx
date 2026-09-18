import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getUser } from "@/lib/admin-users";
import { AppShell } from "@/components/AppShell";
import { EditUserForm } from "@/components/admin/EditUserForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("user:manage");
  const { id } = await params;
  const target = await getUser(user, id);
  if (!target) notFound();

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Users", href: "/admin/users" },
        { label: target.name },
      ]}
    >
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Edit {target.name}</h1>
      <p className="mb-6 text-sm text-slate-500">
        Update profile details, or set a new temporary password.
      </p>
      <EditUserForm
        user={{
          id: target.id, email: target.email, name: target.name,
          title: target.title, licenseNo: target.licenseNo,
        }}
      />
    </AppShell>
  );
}
