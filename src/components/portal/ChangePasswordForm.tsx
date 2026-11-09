"use client";

import { useActionState } from "react";
import { changePortalPasswordAction, type PortalPasswordState } from "@/app/portal/actions";
import { Icon } from "@/components/ui/Icon";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PortalPasswordState, FormData>(changePortalPasswordAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="currentPassword">Current password</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="newPassword">New password</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
