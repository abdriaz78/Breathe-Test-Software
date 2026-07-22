"use server";

import { redirect } from "next/navigation";
import { requireUser, requestContext } from "@/lib/session";
import { saveSamples, saveSamplesSchema } from "@/lib/samples";
import { completeSampleCollection } from "@/lib/workflow";

export interface SamplesFormState {
  error?: string;
  ok?: boolean;
}

function parseRows(formData: FormData) {
  let rows: unknown;
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Could not read the sample data." } as const;
  }

  const parsed = saveSamplesSchema.safeParse({ rows });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.length
      ? ` (row ${Number(first.path[1] ?? first.path[0]) + 1})`
      : "";
    return { error: `${first?.message ?? "Invalid sample data."}${where}` } as const;
  }

  return { rows: parsed.data.rows } as const;
}

export async function saveSamplesAction(
  _prev: SamplesFormState,
  formData: FormData
): Promise<SamplesFormState> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  if (!testId) return { error: "Missing test id." };

  const parsed = parseRows(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const ctx = await requestContext();
    await saveSamples(user, testId, parsed.rows, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save samples." };
  }

  redirect(`/tests/${testId}`);
}

/** Persists the current rows, then marks sample collection complete — locking
 * the report for physician review — in one submit. */
export async function completeSampleCollectionAction(
  _prev: SamplesFormState,
  formData: FormData
): Promise<SamplesFormState> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  if (!testId) return { error: "Missing test id." };

  const parsed = parseRows(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const ctx = await requestContext();
    await saveSamples(user, testId, parsed.rows, ctx);
    await completeSampleCollection(user, testId, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark collection complete." };
  }

  redirect(`/tests/${testId}`);
}
