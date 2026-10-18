"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requestContext } from "@/lib/session";
import {
  createPatient,
  updatePatient,
  patientInputSchema,
  type PatientInput,
} from "@/lib/patients";
import { userMessage } from "@/lib/errors";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function parsePatientForm(
  formData: FormData
): { data: PatientInput } | { state: FormState } {
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
    return { state: { error: "Please correct the highlighted fields.", fieldErrors } };
  }
  return { data: parsed.data };
}

export async function createPatientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();

  const parsed = parsePatientForm(formData);
  if ("state" in parsed) return parsed.state;

  let newId: string;
  try {
    const ctx = await requestContext();
    const result = await createPatient(user, parsed.data, ctx);
    newId = result.id;
  } catch (err) {
    return { error: userMessage(err, "Failed to create patient.") };
  }

  redirect(`/patients/${newId}`);
}

export async function updatePatientAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("patientId") ?? "");
  if (!id) return { error: "Missing patient id." };

  const parsed = parsePatientForm(formData);
  if ("state" in parsed) return parsed.state;

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;

  try {
    const ctx = await requestContext();
    await updatePatient(user, id, parsed.data, reason, ctx);
  } catch (err) {
    return { error: userMessage(err, "Failed to update patient.") };
  }

  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
  redirect(`/patients/${id}`);
}
