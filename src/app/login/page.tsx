"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { BreathWaves } from "@/components/ui/BreathWaves";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

// Abd Report

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }


  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-ink-900 via-brand-900 to-brand-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl" />
        <BreathWaves className="h-48 text-brand-200" />

        <div className="relative animate-fade-in">
          <LogoLockup tone="light" />
        </div>

        <div className="relative max-w-md animate-fade-in-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-inset ring-white/15 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-300" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-300" />
            </span>
            Specter Clinical Platform
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight text-white">
            Breath testing,
            <br />
            <span className="bg-gradient-to-r from-brand-200 to-accent-400 bg-clip-text text-transparent">beautifully simple.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Register patients, run timed sample collection, chart H&#8322; and CH&#8324; in real time, and sign
            professional PDF reports — all in one place.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-200">
            {[
              ["clock", "Live sample-collection reminders"],
              ["activity", "Instant H₂ / CH₄ charts & interpretation support"],
              ["lock", "Encrypted patient data with a full audit trail"],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-brand-200 ring-1 ring-inset ring-white/10">
                  <Icon name={icon as IconName} className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">© {new Date().getFullYear()} Specter Health</p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-1 items-center justify-center bg-clinical-bg px-4 py-12 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_80%_0%,rgba(13,148,136,0.08),transparent)]" />
        <div className="relative w-full max-w-sm animate-scale-in">
          <div className="mb-8 lg:hidden">
            <LogoLockup />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to continue to your clinical workspace.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {error && (
              <div role="alert" className="flex animate-fade-in-up items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <Icon name="alert" className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Icon name="mail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@hospital.ae"
                  className="input py-2.5 pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Icon name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="input py-2.5 pl-10 pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <Icon name="eye" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 text-[15px]" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </span>
              ) : (
                <>
                  Sign in <Icon name="arrowRight" className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <Icon name="shield" className="h-3.5 w-3.5" />
            Authorized hospital personnel only. Activity is audited.
          </p>
        </div>
      </main>
    </div>
  );
}
