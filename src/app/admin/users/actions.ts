"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { requireUser, requestContext } from "@/lib/session";
import {
  createUser, createUserSchema, setUserActive, changeUserRole,
} from "@/lib/admin-users";

export interface UserFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requireUser();
  const raw = {
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    title: String(formData.get("title") ?? ""),
    licenseNo: String(formData.get("licenseNo") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }
  try {
    const ctx = await requestContext();
    await createUser(actor, parsed.data, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create user." };
  }
  redirect("/admin/users");
}

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  const ctx = await requestContext();
  await setUserActive(actor, userId, active, ctx);
  revalidatePath("/admin/users");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const ctx = await requestContext();
  await changeUserRole(actor, userId, role, ctx);
  revalidatePath("/admin/users");
}
