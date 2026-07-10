"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requestContext } from "@/lib/session";
import { saveDiagnosis, finalizeReport, reopenReport } from "@/lib/workflow";

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
    return { error: err instanceof Error ? err.message : "Failed to save." };
  }
  revalidatePath(`/tests/${testId}`);
  return { ok: "Saved." };
}

export async function finalizeAction(
  _prev: WorkflowState,
  formData: FormData
): Promise<WorkflowState> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  try {
    const ctx = await requestContext();
    await finalizeReport(
      user,
      testId,
      {
        diagnosis: String(formData.get("diagnosis") ?? ""),
        recommendation: String(formData.get("recommendation") ?? ""),
      },
      ctx
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to finalize." };
  }
  revalidatePath(`/tests/${testId}`);
  return { ok: "Report finalized." };
}

export async function reopenAction(
  _prev: WorkflowState,
  formData: FormData
): Promise<WorkflowState> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  try {
    const ctx = await requestContext();
    await reopenReport(user, testId, String(formData.get("reason") ?? ""), ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reopen." };
  }
  revalidatePath(`/tests/${testId}`);
  return { ok: "Report reopened." };
}
