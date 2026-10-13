"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import {
  createPatientAction,
  updatePatientAction,
  type FormState,
} from "@/app/patients/actions";

interface HospitalOption {
  id: string;
  name: string;
}

interface PhysicianOption {
  id: string;
  name: string;
  title: string | null;
}

export interface PatientFormValues {
  id: string;
  mrn: string;
  name: string;
  dob: string; // ISO date
  gender: string;
  weightKg: number | null;
  hospitalId: string;
  referringPhysician: string | null;
}

const OTHER_PHYSICIAN = "__other__";

const physicianLabel = (p: PhysicianOption) => (p.title ? `${p.title} ${p.name}` : p.name);

export function PatientForm({
  hospitals,
  physicians,
  lockedHospitalId,
  patient,
}: {
  hospitals: HospitalOption[];
  physicians: PhysicianOption[];
  /** When set (Nurse/Physician accounts), the hospital is fixed to this id and
   * shown read-only instead of a picker. */
  lockedHospitalId?: string;
  /** When set, the form edits this existing patient instead of registering one. */
  patient?: PatientFormValues;
}) {
  const editing = !!patient;
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    editing ? updatePatientAction : createPatientAction,
    {}
  );

  const err = (field: string) => state.fieldErrors?.[field];

  // "Other" keeps this usable for referring physicians who aren't registered
  // system users (the common case — most referrals come from outside doctors).
  const initialPhysician = patient?.referringPhysician ?? "";
  const physicianListed =
    !initialPhysician || physicians.some((p) => physicianLabel(p) === initialPhysician);
  const [physicianMode, setPhysicianMode] = useState<"select" | "other">(
    physicians.length && physicianListed ? "select" : "other"
  );

  return (
    <form
      // Submit via onSubmit rather than `action` so React doesn't reset the
      // fields after a failed submit — the user keeps what they typed.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="card max-w-2xl space-y-5"
    >
      {patient && <input type="hidden" name="patientId" value={patient.id} />}
      {state.error && (
        <div className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="MRN / Patient ID" name="mrn" defaultValue={patient?.mrn} error={err("mrn")} required />
        <Field label="Full name" name="name" defaultValue={patient?.name} error={err("name")} required />
        <Field
          label="Date of birth"
          name="dob"
          type="date"
          defaultValue={patient?.dob.slice(0, 10)}
          error={err("dob")}
          required
        />

        <div>
          <label className="label" htmlFor="gender">
            Gender <span className="text-red-500">*</span>
          </label>
          <select id="gender" name="gender" className="input" defaultValue={patient?.gender ?? ""}>
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

        <Field
          label="Weight (kg)"
          name="weightKg"
          type="number"
          step="0.1"
          defaultValue={patient?.weightKg != null ? String(patient.weightKg) : ""}
          error={err("weightKg")}
        />

        <div>
          <label className="label" htmlFor="hospitalId">
            Hospital <span className="text-red-500">*</span>
          </label>
          {lockedHospitalId ? (
            <>
              <input
                type="text"
                className="input bg-slate-50 text-slate-500"
                value={hospitals.find((h) => h.id === lockedHospitalId)?.name ?? ""}
                disabled
                readOnly
              />
              <input type="hidden" name="hospitalId" value={lockedHospitalId} />
            </>
          ) : (
            <select
              id="hospitalId"
              name="hospitalId"
              className="input"
              defaultValue={patient?.hospitalId ?? ""}
            >
              <option value="" disabled>
                Select…
              </option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}
          {err("hospitalId") && (
            <p className="mt-1 text-xs text-red-600">{err("hospitalId")}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="referringPhysician">
            Referring physician
          </label>
          {physicianMode === "select" ? (
            <select
              id="referringPhysician"
              name="referringPhysician"
              className="input"
              defaultValue={initialPhysician}
              onChange={(e) => {
                if (e.target.value === OTHER_PHYSICIAN) setPhysicianMode("other");
              }}
            >
              <option value="">None</option>
              {physicians.map((p) => {
                const label = physicianLabel(p);
                return (
                  <option key={p.id} value={label}>
                    {label}
                  </option>
                );
              })}
              <option value={OTHER_PHYSICIAN}>Other (not listed)…</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                id="referringPhysician"
                name="referringPhysician"
                type="text"
                className="input"
                placeholder="Referring physician name"
                defaultValue={physicianListed ? "" : initialPhysician}
                autoFocus={physicians.length > 0}
              />
              {physicians.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPhysicianMode("select")}
                  className="whitespace-nowrap text-sm text-brand hover:underline"
                >
                  Choose from list
                </button>
              )}
            </div>
          )}
          {err("referringPhysician") && (
            <p className="mt-1 text-xs text-red-600">{err("referringPhysician")}</p>
          )}
        </div>
      </div>

      {editing && (
        <div>
          <label className="label" htmlFor="reason">
            Reason for correction
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            maxLength={500}
            className="input"
            placeholder="e.g. Date of birth entered incorrectly at registration"
          />
          <p className="mt-1 text-xs text-slate-400">Recorded in the audit trail.</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Register patient"}
        </button>
        <Link href={patient ? `/patients/${patient.id}` : "/patients"} className="btn-secondary">
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
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
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
        step={step}
        defaultValue={defaultValue}
        className="input"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
