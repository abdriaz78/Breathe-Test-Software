"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  updateUserProfileAction, resetUserPasswordAction, type UserFormState,
} from "@/app/admin/users/actions";

export interface EditableUser {
  id: string;
  email: string;
  name: string;
  title: string | null;
  licenseNo: string | null;
}

export function EditUserForm({ user }: { user: EditableUser }) {
  const [profileState, profileAction, profilePending] = useActionState<UserFormState, FormData>(
    updateUserProfileAction,
    {}
  );
  const [pwState, pwAction, pwPending] = useActionState<UserFormState, FormData>(
    resetUserPasswordAction,
    {}
  );
  const profileErr = (f: string) => profileState.fieldErrors?.[f];
  const pwErr = (f: string) => pwState.fieldErrors?.[f];

  return (
    <div className="max-w-2xl space-y-8">
      <section className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Profile
        </h2>
        <form action={profileAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          {profileState.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{profileState.error}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Full name" name="name" defaultValue={user.name} error={profileErr("name")} required />
            <F label="Email" name="email" type="email" defaultValue={user.email} error={profileErr("email")} required />
            <F label="Title" name="title" defaultValue={user.title ?? ""} error={profileErr("title")} placeholder="Dr. / RN / Lab Tech" />
            <F label="License no." name="licenseNo" defaultValue={user.licenseNo ?? ""} error={profileErr("licenseNo")} />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={profilePending}>
              {profilePending ? "Saving…" : "Save profile"}
            </button>
            <Link href="/admin/users" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Reset password
        </h2>
        <form action={pwAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          {pwState.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{pwState.error}</div>
          )}
          {pwState.ok && (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Password updated. Share the new password with {user.name} through a secure channel.
            </div>
          )}
          <div className="max-w-sm">
            <F label="New temporary password" name="password" type="password" error={pwErr("password")} required />
          </div>
          <button type="submit" className="btn-primary" disabled={pwPending}>
            {pwPending ? "Updating…" : "Set new password"}
          </button>
        </form>
      </section>
    </div>
  );
}

function F({
  label, name, type = "text", required, error, placeholder, defaultValue,
}: {
  label: string; name: string; type?: string; required?: boolean; error?: string;
  placeholder?: string; defaultValue?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
