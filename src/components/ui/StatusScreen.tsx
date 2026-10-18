import type { ReactNode } from "react";
import { LogoLockup } from "./Logo";
import { BreathWaves } from "./BreathWaves";

// Full-window message screen for "not found" and unexpected errors.
export function StatusScreen({
  code,
  title,
  message,
  actions,
}: {
  code: string;
  title: string;
  message: string;
  actions: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <BreathWaves className="h-40 text-brand-500" />
      <div className="absolute left-6 top-6">
        <LogoLockup />
      </div>
      <div className="relative animate-scale-in">
        <p className="bg-gradient-to-br from-brand-400 via-brand-600 to-accent-600 bg-clip-text font-display text-8xl font-extrabold tracking-tight text-transparent sm:text-9xl">
          {code}
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      </div>
    </div>
  );
}
