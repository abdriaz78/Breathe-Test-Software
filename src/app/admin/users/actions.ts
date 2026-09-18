"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { requireUser, requestContext } from "@/lib/session";
import {
  createUser, createUserSchema, setUserActive, changeUserRole, changeUserHospital,
  updateUserProfile, updateUserProfileSchema, resetUserPassword, resetPasswordSchema,
} from "@/lib/admin-users";

export interface UserFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
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
    hospitalId: String(formData.get("hospitalId") ?? ""),
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

export async function changeHospitalAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const userId = String(formData.get("userId") ?? "");
  const hospitalId = String(formData.get("hospitalId") ?? "");
  const ctx = await requestContext();
  await changeUserHospital(actor, userId, hospitalId || null, ctx);
  revalidatePath("/admin/users");
}

export async function updateUserProfileAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requireUser();
  const userId = String(formData.get("userId") ?? "");
  const raw = {
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    title: String(formData.get("title") ?? ""),
    licenseNo: String(formData.get("licenseNo") ?? ""),
  };
  const parsed = updateUserProfileSchema.safeParse(raw);
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
    await updateUserProfile(actor, userId, parsed.data, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update user." };
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function resetUserPasswordAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requireUser();
  const userId = String(formData.get("userId") ?? "");
  const raw = { password: String(formData.get("password") ?? "") };
  const parsed = resetPasswordSchema.safeParse(raw);
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
    await resetUserPassword(actor, userId, parsed.data, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reset password." };
  }
  return { ok: true };
}
