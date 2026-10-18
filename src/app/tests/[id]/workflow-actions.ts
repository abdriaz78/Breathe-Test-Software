"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requestContext } from "@/lib/session";
import { saveDiagnosis } from "@/lib/workflow";
import { userMessage } from "@/lib/errors";

export interface WorkflowState {
  error?: string;
  ok?: string;
}

export async function saveDiagnosisAction(
  _prev: WorkflowState,
  formData: FormData
): Promise<WorkflowState> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  try {
    const ctx = await requestContext();
    await saveDiagnosis(
      user,
      testId,
      {
        diagnosis: String(formData.get("diagnosis") ?? ""),
        recommendation: String(formData.get("recommendation") ?? ""),
      },
      ctx
    );
  } catch (err) {
    return { error: userMessage(err, "Failed to save.") };
  }
  revalidatePath(`/tests/${testId}`);
  return { ok: "Saved." };
}
