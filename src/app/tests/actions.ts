"use server";

import { redirect } from "next/navigation";
import { requireUser, requestContext } from "@/lib/session";
import { createTest, testInputSchema } from "@/lib/tests";

export interface TestFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createTestAction(
  _prev: TestFormState,
  formData: FormData
): Promise<TestFormState> {
  const user = await requireUser();

  const raw = {
    patientId: String(formData.get("patientId") ?? ""),
    testTypeId: String(formData.get("testTypeId") ?? ""),
    departmentId: String(formData.get("departmentId") ?? ""),
    substrate: String(formData.get("substrate") ?? ""),
    dose: String(formData.get("dose") ?? ""),
    collectionDate: String(formData.get("collectionDate") ?? ""),
    analysisDate: String(formData.get("analysisDate") ?? ""),
    technicianId: String(formData.get("technicianId") ?? ""),
    preTestSymptoms: String(formData.get("preTestSymptoms") ?? ""),
    preTestNotes: String(formData.get("preTestNotes") ?? ""),
  };

  const parsed = testInputSchema.safeParse(raw);
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
    const result = await createTest(user, parsed.data, ctx);
    newId = result.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create test." };
  }

  redirect(`/tests/${newId}`);
}
