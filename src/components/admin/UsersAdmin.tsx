"use client";

import { useActionState } from "react";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/rbac";
import {
  createUserAction, toggleUserActiveAction, changeRoleAction, type UserFormState,
} from "@/app/admin/users/actions";

const ROLES: Role[] = ["ADMIN", "NURSE", "PHYSICIAN", "SPECTER_SUPPORT"];

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export function UsersAdmin({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    createUserAction,
    {}
  );
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <div className="space-y-8">
      {/* Create */}
      <section className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Add staff account
        </h2>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <F label="Full name" name="name" error={err("name")} required />
            <F label="Email" name="email" type="email" error={err("email")} required />
            <div>
              <label className="label" htmlFor="role">Role <span className="text-red-500">*</span></label>
              <select id="role" name="role" className="input" defaultValue="NURSE">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <F label="Title" name="title" error={err("title")} placeholder="Dr. / RN / Lab Tech" />
            <F label="License no." name="licenseNo" error={err("licenseNo")} />
            <F label="Temporary password" name="password" type="password" error={err("password")} required />
          </div>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>

      {/* List */}
      <section>
        <div className="overflow-x-auto rounded-lg border border-clinical-border bg-white">
          <table className="min-w-full divide-y divide-clinical-border text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-border">
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "bg-slate-50 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.title ? `${u.title} ` : ""}{u.name}
                    {u.id === currentUserId && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <form action={changeRoleAction} className="inline">
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded border border-clinical-border bg-white px-2 py-1 text-xs"
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== currentUserId && (
                      <form action={toggleUserActiveAction} className="inline">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="active" value={(!u.isActive).toString()} />
                        <button type="submit" className="text-brand hover:underline">
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function F({
  label, name, type = "text", required, error, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean; error?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={name} name={name} type={type} className="input" placeholder={placeholder} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
