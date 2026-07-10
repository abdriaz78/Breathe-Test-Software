"use server";

import { redirect } from "next/navigation";
import { requireUser, requestContext } from "@/lib/session";
import { saveSamples, saveSamplesSchema } from "@/lib/samples";

export interface SamplesFormState {
  error?: string;
  ok?: boolean;
}

export async function saveSamplesAction(
  _prev: SamplesFormState,
  formData: FormData
): Promise<SamplesFormState> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  if (!testId) return { error: "Missing test id." };

  let rows: unknown;
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Could not read the sample data." };
  }

  const parsed = saveSamplesSchema.safeParse({ rows });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.length
      ? ` (row ${Number(first.path[1] ?? first.path[0]) + 1})`
      : "";
    return { error: `${first?.message ?? "Invalid sample data."}${where}` };
  }

  try {
    const ctx = await requestContext();
    await saveSamples(user, testId, parsed.data.rows, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save samples." };
  }

  redirect(`/tests/${testId}`);
}
