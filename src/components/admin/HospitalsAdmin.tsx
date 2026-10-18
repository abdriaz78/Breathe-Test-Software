"use client";

import { useActionState, useEffect, useState, useTransition, type ChangeEvent } from "react";
import {
  createHospitalAction, updateHospitalAction, deleteHospitalAction, addDepartmentAction,
  saveHospitalLogoAction, type HospitalFormState,
} from "@/app/admin/hospitals/actions";
import { Icon } from "@/components/ui/Icon";

export interface AdminHospital {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  country: string;
  logoUrl: string | null;
  patientCount: number;
  userCount: number;
  departments: Array<{ id: string; name: string }>;
}

export function HospitalsAdmin({ hospitals }: { hospitals: AdminHospital[] }) {
  const [state, action, pending] = useActionState<HospitalFormState, FormData>(createHospitalAction, {});
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <div className="space-y-8">
      <section className="card">
        <h2 className="mb-4 font-display text-base font-semibold text-slate-900">Add hospital</h2>
        <form action={action} className="space-y-4">
          {state.error && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <F label="Name" name="name" error={err("name")} required />
            <F label="Code" name="code" error={err("code")} />
            <F label="City" name="city" />
            <F label="Country" name="country" placeholder="United Arab Emirates" />
          </div>
          <button type="submit" className="btn-primary" disabled={pending}>
            <Icon name="plus" className="h-4 w-4" />
            {pending ? "Creating…" : "Create hospital"}
          </button>
        </form>
      </section>

      <div className="space-y-4">
        {hospitals.map((h) => (
          <section key={h.id} className="card">
            <HospitalHeader hospital={h} />

            <div className="mb-3 flex flex-wrap gap-2">
              {h.departments.length === 0 && (
                <span className="text-sm text-slate-400">No departments yet.</span>
              )}
              {h.departments.map((d) => (
                <span key={d.id} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-100">
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

function HospitalHeader({ hospital: h }: { hospital: AdminHospital }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<HospitalFormState, FormData>(updateHospitalAction, {});
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const err = (f: string) => state.fieldErrors?.[f];

  // Close the editor once a save succeeds.
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  function onDelete() {
    const ok = window.confirm(
      `Delete hospital "${h.name}" and its ${h.departments.length} department(s)? This cannot be undone.`
    );
    if (!ok) return;
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteHospitalAction(h.id);
      if (res.error) setDeleteError(res.error);
    });
  }

  if (editing) {
    return (
      <form action={action} className="mb-4 space-y-4 rounded-md border border-clinical-border bg-slate-50 p-4">
        <input type="hidden" name="hospitalId" value={h.id} />
        {state.error && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <F idPrefix={h.id} label="Name" name="name" error={err("name")} required defaultValue={h.name} />
          <F idPrefix={h.id} label="Code" name="code" error={err("code")} defaultValue={h.code ?? ""} />
          <F idPrefix={h.id} label="City" name="city" error={err("city")} defaultValue={h.city ?? ""} />
          <F idPrefix={h.id} label="Country" name="country" error={err("country")} defaultValue={h.country} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const inUse = h.patientCount > 0 || h.userCount > 0;
  return (
    <div className="mb-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2.5 font-display text-lg font-semibold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
              <Icon name="building" className="h-[18px] w-[18px]" />
            </span>
            {h.name}
          </h3>
          <p className="mt-0.5 pl-[46px] text-xs text-slate-500">
            {[h.code, h.city, h.country].filter(Boolean).join(" · ")} · {h.patientCount} patient(s) ·{" "}
            {h.userCount} staff
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setEditing(true)}>
            <Icon name="pencil" className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            title={inUse ? "Hospitals with patients or staff cannot be deleted" : "Delete hospital"}
            className="btn-danger"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
      {state.ok && <p className="mt-1 text-xs text-green-600">{state.ok}</p>}
      {deleteError && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{deleteError}</p>}
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
  label, name, error, required, placeholder, defaultValue, idPrefix,
}: {
  label: string; name: string; error?: string; required?: boolean; placeholder?: string;
  defaultValue?: string; idPrefix?: string;
}) {
  const id = idPrefix ? `${idPrefix}-${name}` : name;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={id} name={name} className="input" placeholder={placeholder} defaultValue={defaultValue} />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
