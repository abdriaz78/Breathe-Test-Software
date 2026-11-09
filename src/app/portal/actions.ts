"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { patientFromSession, requestContext } from "@/lib/session";
import { changeOwnPassword } from "@/lib/portal";
import { userMessage } from "@/lib/errors";

export interface PortalPasswordState {
  error?: string;
}

export async function changePortalPasswordAction(
  _prev: PortalPasswordState,
  formData: FormData
): Promise<PortalPasswordState> {
  const me = patientFromSession(await auth());
  if (!me) return { error: "Your session has ended. Please sign in again." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next !== confirm) return { error: "The new passwords do not match." };

  try {
    await changeOwnPassword(me, current, next, await requestContext());
  } catch (err) {
    return { error: userMessage(err, "Could not change your password.") };
  }
  redirect("/portal");
}
