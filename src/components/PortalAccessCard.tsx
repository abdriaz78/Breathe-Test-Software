"use client";

import { useActionState, useState } from "react";
import {
  disablePortalAccessAction,
  issuePortalAccessAction,
  type PortalAccessState,
} from "@/app/patients/portal-actions";
import { Icon } from "@/components/ui/Icon";

interface Status {
  enabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
}

function fmt(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "never";
}

/** Staff control for a patient's report-portal login (portal:manage). */
export function PortalAccessCard({ patientId, status }: { patientId: string; status: Status }) {
  const [issued, issueAction, issuing] = useActionState<PortalAccessState, FormData>(issuePortalAccessAction, {});
  const [disabled, disableAction, disabling] = useActionState<PortalAccessState, FormData>(disablePortalAccessAction, {});
  const [copied, setCopied] = useState(false);

  const error = issued.error || disabled.error;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — staff can still read it off the screen */
    }
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login";

  return (
    <section className="card mt-6 max-w-4xl" data-testid="portal-access-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <Icon name="fileText" className="h-4 w-4 text-brand-600" /> Patient portal access
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Lets the patient sign in with their MRN to view and download <strong>their own finalized reports</strong> only.
          </p>
          <p className="mt-2 text-sm">
            {status.enabled ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">Enabled</span>
                <span className="text-slate-500">Last sign-in: {fmt(status.lastLoginAt)}</span>
                {status.mustChangePassword && <span className="text-amber-700">· Temporary password not yet changed</span>}
                {status.lockedUntil && <span className="text-red-700">· Locked until {fmt(status.lockedUntil)} (reset to unlock)</span>}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">Not enabled</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form
            action={issueAction}
            onSubmit={(e) => {
              if (status.enabled && !confirm("Reset the patient's portal password? Their current password stops working and they are signed out.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="patientId" value={patientId} />
            <button type="submit" className="btn-primary" disabled={issuing}>
              <Icon name="lock" className="h-4 w-4" />
              {issuing ? "Working…" : status.enabled ? "Reset password" : "Enable portal access"}
            </button>
          </form>
          {status.enabled && (
            <form
              action={disableAction}
              onSubmit={(e) => {
                if (!confirm("Disable portal access for this patient?")) e.preventDefault();
              }}
            >
              <input type="hidden" name="patientId" value={patientId} />
              <button type="submit" className="btn-secondary" disabled={disabling}>
                {disabling ? "Working…" : "Disable"}
              </button>
            </form>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
      )}
      {disabled.ok && !issued.tempPassword && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{disabled.ok}</p>
      )}

      {issued.tempPassword && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status" data-testid="portal-temp-password">
          <p className="text-sm font-semibold text-amber-900">Give these sign-in details to the patient. The password is shown only once.</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-amber-800">Sign-in page</dt>
            <dd className="break-all font-mono text-slate-900">{loginUrl}</dd>
            <dt className="text-amber-800">MRN</dt>
            <dd className="font-mono text-slate-900">{issued.mrn}</dd>
            <dt className="text-amber-800">Temporary password</dt>
            <dd className="flex items-center gap-2">
              <code className="rounded-md bg-white px-2 py-1 font-mono text-base tracking-wider text-slate-900 ring-1 ring-amber-200" data-testid="temp-password-value">
                {issued.tempPassword}
              </code>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => copy(`Sign in: ${loginUrl}\nMRN: ${issued.mrn}\nTemporary password: ${issued.tempPassword}`)}>
                {copied ? "Copied" : "Copy"}
              </button>
            </dd>
          </dl>
          <p className="mt-3 text-xs text-amber-800">The patient must choose their own password the first time they sign in.</p>
        </div>
      )}
    </section>
  );
}
