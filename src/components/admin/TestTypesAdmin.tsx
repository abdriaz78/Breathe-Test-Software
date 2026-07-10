"use client";

import { useActionState } from "react";
import {
  createTestTypeAction, updateTestTypeAction, toggleTestTypeActiveAction,
  type TestTypeFormState,
} from "@/app/admin/test-types/actions";

export interface AdminTestType {
  id: string;
  key: string;
  name: string;
  defaultSubstrate: string | null;
  defaultDose: string | null;
  isSystem: boolean;
  isActive: boolean;
  h2RiseFromBaselinePpm?: number;
  ch4AbsolutePpm?: number;
  combinedRiseFromBaselinePpm?: number;
}

export function TestTypesAdmin({ testTypes }: { testTypes: AdminTestType[] }) {
  return (
    <div className="space-y-8">
      <CreateCard />
      <div className="space-y-4">
        {testTypes.map((t) => (
          <EditCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

function ThresholdFields({ t }: { t?: AdminTestType }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <NumF label="H₂ rise ≥ (ppm)" name="h2RiseFromBaselinePpm" def={t?.h2RiseFromBaselinePpm} />
      <NumF label="CH₄ absolute ≥ (ppm)" name="ch4AbsolutePpm" def={t?.ch4AbsolutePpm} />
      <NumF label="H₂+CH₄ rise ≥ (ppm)" name="combinedRiseFromBaselinePpm" def={t?.combinedRiseFromBaselinePpm} />
    </div>
  );
}

function CreateCard() {
  const [state, action, pending] = useActionState<TestTypeFormState, FormData>(createTestTypeAction, {});
  const err = (f: string) => state.fieldErrors?.[f];
  return (
    <section className="card">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Add custom test type
      </h2>
      <form action={action} className="space-y-4">
        {state.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextF label="Name" name="name" error={err("name")} required />
          <TextF label="Default substrate" name="defaultSubstrate" />
          <TextF label="Default dose" name="defaultDose" />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Interpretation-support thresholds (optional)
          </p>
          <ThresholdFields />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create test type"}
        </button>
      </form>
    </section>
  );
}

function EditCard({ t }: { t: AdminTestType }) {
  const [state, action, pending] = useActionState<TestTypeFormState, FormData>(updateTestTypeAction, {});
  const err = (f: string) => state.fieldErrors?.[f];
  return (
    <section className={`card ${t.isActive ? "" : "opacity-70"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {t.name}
            {t.isSystem && (
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                built-in
              </span>
            )}
            {!t.isActive && (
              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                disabled
              </span>
            )}
          </h3>
          <p className="font-mono text-xs text-slate-400">{t.key}</p>
        </div>
        <form action={toggleTestTypeActiveAction}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="active" value={(!t.isActive).toString()} />
          <button type="submit" className="text-sm text-brand hover:underline">
            {t.isActive ? "Disable" : "Enable"}
          </button>
        </form>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={t.id} />
        {state.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        {state.ok && !state.error && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextF label="Name" name="name" def={t.name} error={err("name")} required />
          <TextF label="Default substrate" name="defaultSubstrate" def={t.defaultSubstrate ?? ""} />
          <TextF label="Default dose" name="defaultDose" def={t.defaultDose ?? ""} />
        </div>
        <ThresholdFields t={t} />
        <button type="submit" className="btn-secondary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}

function TextF({
  label, name, def, error, required,
}: { label: string; name: string; def?: string; error?: string; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={`${name}-${def ?? ""}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input name={name} defaultValue={def} className="input" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function NumF({ label, name, def }: { label: string; name: string; def?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type="number" step="0.1" defaultValue={def ?? ""} className="input" />
    </div>
  );
}
