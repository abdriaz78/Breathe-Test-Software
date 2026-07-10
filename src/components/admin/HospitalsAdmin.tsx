"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import {
  createHospitalAction, addDepartmentAction, saveHospitalLogoAction, type HospitalFormState,
} from "@/app/admin/hospitals/actions";

export interface AdminHospital {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  country: string;
  logoUrl: string | null;
  patientCount: number;
  departments: Array<{ id: string; name: string }>;
}

export function HospitalsAdmin({ hospitals }: { hospitals: AdminHospital[] }) {
  const [state, action, pending] = useActionState<HospitalFormState, FormData>(createHospitalAction, {});
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <div className="space-y-8">
      <section className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Add hospital</h2>
        <form action={action} className="space-y-4">
          {state.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <F label="Name" name="name" error={err("name")} required />
            <F label="Code" name="code" error={err("code")} />
            <F label="City" name="city" />
            <F label="Country" name="country" placeholder="United Arab Emirates" />
          </div>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create hospital"}
          </button>
        </form>
      </section>

      <div className="space-y-4">
        {hospitals.map((h) => (
          <section key={h.id} className="card">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{h.name}</h3>
                <p className="text-xs text-slate-500">
                  {[h.code, h.city, h.country].filter(Boolean).join(" · ")} · {h.patientCount} patient(s)
                </p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {h.departments.length === 0 && (
                <span className="text-sm text-slate-400">No departments yet.</span>
              )}
              {h.departments.map((d) => (
                <span key={d.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {d.name}
                </span>
              ))}
            </div>

            <form action={addDepartmentAction} className="flex gap-2">
              <input type="hidden" name="hospitalId" value={h.id} />
              <input name="name" placeholder="New department name" className="input max-w-xs" required />
              <button type="submit" className="btn-secondary">Add department</button>
            </form>

            <div className="mt-4 border-t border-clinical-border pt-4">
              <LogoUploader hospitalId={h.id} currentLogo={h.logoUrl} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const MAX_LOGO_BYTES = 500 * 1024; // 500 KB

function LogoUploader({
  hospitalId,
  currentLogo,
}: {
  hospitalId: string;
  currentLogo: string | null;
}) {
  const [state, action, pending] = useActionState<HospitalFormState, FormData>(
    saveHospitalLogoAction,
    {}
  );
  const [preview, setPreview] = useState<string | null>(currentLogo);
  const [localErr, setLocalErr] = useState<string | null>(null);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    setLocalErr(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setLocalErr("Please choose a PNG or JPG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLocalErr("Image is too large. Please use one under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm font-medium text-slate-700">Report logo</p>
      <input type="hidden" name="hospitalId" value={hospitalId} />
      <input type="hidden" name="logoDataUri" value={preview ?? ""} />

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed border-clinical-border bg-slate-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-slate-400">No logo</span>
          )}
        </div>

        <div className="space-y-2">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={onFile}
            className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
          />
          <p className="text-xs text-slate-400">PNG or JPG, up to 500 KB. Shown in the top corner of the PDF report.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save logo"}
        </button>
        {preview && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setPreview(null);
              setLocalErr(null);
            }}
          >
            Remove
          </button>
        )}
        {localErr && <span className="text-xs text-red-600">{localErr}</span>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.ok && <span className="text-xs text-green-600">{state.ok}</span>}
      </div>
    </form>
  );
}

function F({
  label, name, error, required, placeholder,
}: { label: string; name: string; error?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={name} name={name} className="input" placeholder={placeholder} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
