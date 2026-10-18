"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/primitives";
import { createTestAction, type TestFormState } from "@/app/tests/actions";

export interface TestTypeOption {
  id: string;
  name: string;
  defaultSubstrate: string | null;
  defaultDose: string | null;
}

export interface SimpleOption {
  id: string;
  label: string;
}

export function TestForm({
  patient,
  testTypes,
  departments,
  technicians,
}: {
  patient: { id: string; name: string; mrn: string };
  testTypes: TestTypeOption[];
  departments: SimpleOption[];
  technicians: SimpleOption[];
}) {
  const [state, formAction, pending] = useActionState<TestFormState, FormData>(
    createTestAction,
    {}
  );

  // Controlled substrate/dose so selecting a test type can auto-fill them.
  const [substrate, setSubstrate] = useState("");
  const [dose, setDose] = useState("");
  // Track whether the user has manually edited, so we don't clobber their input.
  const substrateTouched = useRef(false);
  const doseTouched = useRef(false);

  function onTestTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tt = testTypes.find((t) => t.id === e.target.value);
    if (!tt) return;
    if (!substrateTouched.current) setSubstrate(tt.defaultSubstrate ?? "");
    if (!doseTouched.current) setDose(tt.defaultDose ?? "");
  }

  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="card max-w-2xl space-y-5">
      {state.error && (
        <div className="animate-fade-in-up rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-gradient-to-r from-brand-50 to-sky-50 px-4 py-3">
        <input type="hidden" name="patientId" value={patient.id} />
        <Avatar name={patient.name} size="sm" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700/70">Patient</p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {patient.name}{" "}
            <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-xs font-normal text-slate-600">
              MRN {patient.mrn}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="testTypeId">
            Test type <span className="text-red-500">*</span>
          </label>
          <select
            id="testTypeId"
            name="testTypeId"
            className="input"
            defaultValue=""
            onChange={onTestTypeChange}
          >
            <option value="" disabled>
              Select…
            </option>
            {testTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {err("testTypeId") && (
            <p className="field-error">{err("testTypeId")}</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="departmentId">
            Department
          </label>
          <select id="departmentId" name="departmentId" className="input" defaultValue="">
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="substrate">
            Substrate
          </label>
          <input
            id="substrate"
            name="substrate"
            className="input"
            value={substrate}
            onChange={(e) => {
              substrateTouched.current = true;
              setSubstrate(e.target.value);
            }}
          />
        </div>

        <div>
          <label className="label" htmlFor="dose">
            Dose
          </label>
          <input
            id="dose"
            name="dose"
            className="input"
            value={dose}
            onChange={(e) => {
              doseTouched.current = true;
              setDose(e.target.value);
            }}
          />
        </div>

        <div>
          <label className="label" htmlFor="collectionDate">
            Collection date
          </label>
          <input id="collectionDate" name="collectionDate" type="date" className="input" />
        </div>

        <div>
          <label className="label" htmlFor="analysisDate">
            Analysis date
          </label>
          <input id="analysisDate" name="analysisDate" type="date" className="input" />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="technicianId">
            Nurse / technician
          </label>
          <select id="technicianId" name="technicianId" className="input" defaultValue="">
            <option value="">—</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="preTestSymptoms">
            Pre-test symptoms
          </label>
          <textarea
            id="preTestSymptoms"
            name="preTestSymptoms"
            rows={2}
            className="input"
            placeholder="e.g. bloating, abdominal discomfort"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="preTestNotes">
            Pre-test notes
          </label>
          <textarea id="preTestNotes" name="preTestNotes" rows={3} className="input" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create test"}
        </button>
        <Link href={`/patients/${patient.id}`} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
