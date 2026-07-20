"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requestContext } from "@/lib/session";
import { acknowledgeSample, startTimer } from "@/lib/timers";

export interface TimerFormState {
  error?: string;
  ok?: boolean;
}

export async function startTimerAction(
  _prev: TimerFormState,
  formData: FormData
): Promise<TimerFormState> {
  const user = await requireUser();
  const testId = String(formData.get("testId") ?? "");
  if (!testId) return { error: "Missing test id." };

  try {
    const ctx = await requestContext();
    await startTimer(
      user,
      testId,
      {
        intervalMinutes: Number(formData.get("intervalMinutes")),
        totalSamples: Number(formData.get("totalSamples")),
      },
      ctx
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start the timer." };
  }

  revalidatePath(`/tests/${testId}`);
  return { ok: true };
}

/** Called from the header widget and the test page, so it takes plain args. */
export async function acknowledgeSampleAction(
  testId: string,
  sampleIndex: number
): Promise<TimerFormState> {
  const user = await requireUser();
  if (!testId) return { error: "Missing test id." };

  try {
    const ctx = await requestContext();
    await acknowledgeSample(user, testId, sampleIndex, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not acknowledge the sample." };
  }

  revalidatePath(`/tests/${testId}`);
  return { ok: true };
}
