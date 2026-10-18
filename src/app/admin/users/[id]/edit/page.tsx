import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getUser } from "@/lib/admin-users";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/primitives";
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
      <PageHeader
        icon="pencil"
        title={<>Edit {target.name}</>}
        description={
          <>
            Update profile details, or set a new temporary password.
          </>
        }
      />
      <EditUserForm
        user={{
          id: target.id, email: target.email, name: target.name,
          title: target.title, licenseNo: target.licenseNo,
        }}
      />
    </AppShell>
  );
}
