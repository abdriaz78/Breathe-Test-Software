"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requestContext } from "@/lib/session";
import {
  createHospital, updateHospital, deleteHospital, hospitalSchema, addDepartment, setHospitalLogo,
} from "@/lib/admin-hospitals";
import { userMessage } from "@/lib/errors";

export interface HospitalFormState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
}

function parseHospitalForm(formData: FormData) {
  const parsed = hospitalSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    city: String(formData.get("city") ?? ""),
    country: String(formData.get("country") ?? ""),
  });
  if (parsed.success) return { data: parsed.data } as const;
  const fieldErrors: Record<string, string> = {};
  for (const i of parsed.error.issues) {
    const k = String(i.path[0] ?? "form");
    if (!fieldErrors[k]) fieldErrors[k] = i.message;
  }
  return { error: { error: "Please correct the highlighted fields.", fieldErrors } } as const;
}

export async function createHospitalAction(
  _prev: HospitalFormState,
  formData: FormData
): Promise<HospitalFormState> {
  const actor = await requireUser();
  const parsed = parseHospitalForm(formData);
  if (parsed.error) return parsed.error;
  try {
    const ctx = await requestContext();
    await createHospital(actor, parsed.data, ctx);
  } catch (err) {
    return { error: userMessage(err, "Failed to create hospital.") };
  }
  revalidatePath("/admin/hospitals");
  return { ok: "Hospital created." };
}

export async function updateHospitalAction(
  _prev: HospitalFormState,
  formData: FormData
): Promise<HospitalFormState> {
  const actor = await requireUser();
  const hospitalId = String(formData.get("hospitalId") ?? "");
  const parsed = parseHospitalForm(formData);
  if (parsed.error) return parsed.error;
  try {
    const ctx = await requestContext();
    await updateHospital(actor, hospitalId, parsed.data, ctx);
  } catch (err) {
    return { error: userMessage(err, "Failed to update hospital.") };
  }
  revalidatePath("/admin/hospitals");
  return { ok: "Hospital updated." };
}

export async function deleteHospitalAction(hospitalId: string): Promise<HospitalFormState> {
  const actor = await requireUser();
  try {
    const ctx = await requestContext();
    await deleteHospital(actor, hospitalId, ctx);
  } catch (err) {
    return { error: userMessage(err, "Failed to delete hospital.") };
  }
  revalidatePath("/admin/hospitals");
  return { ok: "Hospital deleted." };
}

export async function saveHospitalLogoAction(
  _prev: HospitalFormState,
  formData: FormData
): Promise<HospitalFormState> {
  const actor = await requireUser();
  const hospitalId = String(formData.get("hospitalId") ?? "");
  const logo = String(formData.get("logoDataUri") ?? "");
  try {
    const ctx = await requestContext();
    await setHospitalLogo(actor, hospitalId, logo || null, ctx);
  } catch (err) {
    return { error: userMessage(err, "Failed to save logo.") };
  }
  revalidatePath("/admin/hospitals");
  return { ok: logo ? "Logo saved." : "Logo removed." };
}

export async function addDepartmentAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const hospitalId = String(formData.get("hospitalId") ?? "");
  const name = String(formData.get("name") ?? "");
  const ctx = await requestContext();
  await addDepartment(actor, hospitalId, name, ctx);
  revalidatePath("/admin/hospitals");
}
