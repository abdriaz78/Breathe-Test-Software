"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requestContext } from "@/lib/session";
import { disablePortalAccess, issuePortalAccess } from "@/lib/portal";
import { userMessage } from "@/lib/errors";

export interface PortalAccessState {
  error?: string;
  /** Shown to staff exactly once, right after issuing/resetting. */
  tempPassword?: string;
  mrn?: string;
  ok?: string;
}

export async function issuePortalAccessAction(
  _prev: PortalAccessState,
  formData: FormData
): Promise<PortalAccessState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return { error: "Missing patient id." };
  try {
    const { tempPassword, mrn } = await issuePortalAccess(user, patientId, await requestContext());
    revalidatePath(`/patients/${patientId}`);
    return { tempPassword, mrn };
  } catch (err) {
    return { error: userMessage(err, "Could not set up portal access.") };
  }
}

export async function disablePortalAccessAction(
  _prev: PortalAccessState,
  formData: FormData
): Promise<PortalAccessState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return { error: "Missing patient id." };
  try {
    await disablePortalAccess(user, patientId, await requestContext());
    revalidatePath(`/patients/${patientId}`);
    return { ok: "Portal access disabled. The patient has been signed out." };
  } catch (err) {
    return { error: userMessage(err, "Could not disable portal access.") };
  }
}
