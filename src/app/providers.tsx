"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense, type ReactNode } from "react";
import { TimerProvider } from "@/components/TimerProvider";
import { NavProgress } from "@/components/ui/NavProgress";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <TimerProvider>{children}</TimerProvider>
    </SessionProvider>
  );
}
