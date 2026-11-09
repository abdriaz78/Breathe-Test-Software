import { requirePatient } from "@/lib/session";
import { getOwnProfile } from "@/lib/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { ChangePasswordForm } from "@/components/portal/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function PortalChangePasswordPage() {
  const me = await requirePatient({ allowPendingPassword: true });
  const profile = await getOwnProfile(me);

  return (
    <PortalShell hospitalName={profile?.hospitalName}>
      <div className="card mx-auto max-w-md">
        <h1 className="font-display text-xl font-bold text-slate-900">
          {me.mustChangePassword ? "Choose your own password" : "Change password"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {me.mustChangePassword
            ? "You signed in with a temporary password from your hospital. Please choose a new one to continue."
            : "Use at least 8 characters, including a letter and a number."}
        </p>
        <ChangePasswordForm />
      </div>
    </PortalShell>
  );
}
