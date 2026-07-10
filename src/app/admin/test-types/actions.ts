"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requestContext } from "@/lib/session";
import {
  createTestType, updateTestType, setTestTypeActive, testTypeSchema,
} from "@/lib/admin-testtypes";

export interface TestTypeFormState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
}

function readInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    defaultSubstrate: String(formData.get("defaultSubstrate") ?? ""),
    defaultDose: String(formData.get("defaultDose") ?? ""),
    h2RiseFromBaselinePpm: String(formData.get("h2RiseFromBaselinePpm") ?? ""),
    ch4AbsolutePpm: String(formData.get("ch4AbsolutePpm") ?? ""),
    combinedRiseFromBaselinePpm: String(formData.get("combinedRiseFromBaselinePpm") ?? ""),
  };
}

function fieldErrorsFrom(issues: { path: (string | number)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    if (!fieldErrors[k]) fieldErrors[k] = i.message;
  }
  return fieldErrors;
}

export async function createTestTypeAction(
  _prev: TestTypeFormState,
  formData: FormData
): Promise<TestTypeFormState> {
  const actor = await requireUser();
  const parsed = testTypeSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return { error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  try {
    const ctx = await requestContext();
    await createTestType(actor, parsed.data, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create test type." };
  }
  revalidatePath("/admin/test-types");
  return { ok: "Test type created." };
}

export async function updateTestTypeAction(
  _prev: TestTypeFormState,
  formData: FormData
): Promise<TestTypeFormState> {
  const actor = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = testTypeSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    return { error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  try {
    const ctx = await requestContext();
    await updateTestType(actor, id, parsed.data, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update test type." };
  }
  revalidatePath("/admin/test-types");
  return { ok: "Saved." };
}

export async function toggleTestTypeActiveAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  const ctx = await requestContext();
  await setTestTypeActive(actor, id, active, ctx);
  revalidatePath("/admin/test-types");
}
