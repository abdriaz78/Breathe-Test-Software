"use client";

import { signOut } from "next-auth/react";
import { Icon } from "@/components/ui/Icon";

export function PortalSignOut() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/portal/login" })}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
    >
      <Icon name="logOut" className="h-4 w-4" /> Sign out
    </button>
  );
}
