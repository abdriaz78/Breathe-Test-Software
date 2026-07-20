"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { TimerProvider } from "@/components/TimerProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TimerProvider>{children}</TimerProvider>
    </SessionProvider>
  );
}
