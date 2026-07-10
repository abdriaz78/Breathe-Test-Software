"use server";

import { redirect } from "next/navigation";
import { requireUser, requestContext } from "@/lib/session";
import { createPatient, patientInputSchema } from "@/lib/patients";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createPatientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();

  const raw = {
    mrn: String(formData.get("mrn") ?? ""),
    name: String(formData.get("name") ?? ""),
    dob: String(formData.get("dob") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    weightKg: String(formData.get("weightKg") ?? ""),
    hospitalId: String(formData.get("hospitalId") ?? ""),
    referringPhysician: String(formData.get("referringPhysician") ?? ""),
  };

  const parsed = patientInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }

  let newId: string;
  try {
    const ctx = await requestContext();
    const result = await createPatient(user, parsed.data, ctx);
    newId = result.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create patient." };
  }

  redirect(`/patients/${newId}`);
}
