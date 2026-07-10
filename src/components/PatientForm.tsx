"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createPatientAction, type FormState } from "@/app/patients/actions";

interface HospitalOption {
  id: string;
  name: string;
}

export function PatientForm({ hospitals }: { hospitals: HospitalOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPatientAction,
    {}
  );

  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="card max-w-2xl space-y-5">
      {state.error && (
        <div className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="MRN / Patient ID" name="mrn" error={err("mrn")} required />
        <Field label="Full name" name="name" error={err("name")} required />
        <Field label="Date of birth" name="dob" type="date" error={err("dob")} required />

        <div>
          <label className="label" htmlFor="gender">
            Gender <span className="text-red-500">*</span>
          </label>
          <select id="gender" name="gender" className="input" defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="UNDISCLOSED">Undisclosed</option>
          </select>
          {err("gender") && <p className="mt-1 text-xs text-red-600">{err("gender")}</p>}
        </div>

        <Field label="Weight (kg)" name="weightKg" type="number" step="0.1" error={err("weightKg")} />

        <div>
          <label className="label" htmlFor="hospitalId">
            Hospital <span className="text-red-500">*</span>
          </label>
          <select id="hospitalId" name="hospitalId" className="input" defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          {err("hospitalId") && (
            <p className="mt-1 text-xs text-red-600">{err("hospitalId")}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Referring physician"
            name="referringPhysician"
            error={err("referringPhysician")}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Register patient"}
        </button>
        <Link href="/patients" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  required,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={name} name={name} type={type} step={step} className="input" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
