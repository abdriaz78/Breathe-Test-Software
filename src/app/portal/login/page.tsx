"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";

// Patient-portal sign-in: MRN (the patient ID printed on their hospital
// paperwork) + the password issued by hospital staff.
export default function PortalLoginPage() {
  const router = useRouter();
  const [mrn, setMrn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("patient", { mrn, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError(
        res.error.startsWith("Too many failed attempts")
          ? res.error
          : "The MRN or password is incorrect, or portal access is not enabled. Please contact your hospital if you need help."
      );
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-clinical-bg px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_0%,rgba(13,148,136,0.10),transparent)]" />
      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="mb-8">
          <LogoLockup />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
          <Icon name="fileText" className="h-3.5 w-3.5" /> Patient portal
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900">View your reports</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in with your MRN (patient ID) and the password your hospital gave you.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {error && (
            <div role="alert" className="flex animate-fade-in-up items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="label" htmlFor="mrn">MRN / Patient ID</label>
            <div className="relative">
              <Icon name="users" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="mrn"
                name="mrn"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                required
                placeholder="e.g. MRN-100234"
                className="input py-2.5 pl-10"
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <Icon name="lock" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
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

        <div className="mt-6 space-y-3">
          <InstallAppButton />
          <a href="/login" className="block text-center text-sm font-medium text-slate-500 hover:text-brand-700">
            Hospital staff? Sign in here
          </a>
        </div>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <Icon name="shield" className="h-3.5 w-3.5" />
          You can only see your own reports. Access is logged.
        </p>
      </div>
    </div>
  );
}
