"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

// Abd
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen items-center justify-center bg-clinical-bg p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white shadow-md transition-transform duration-300 hover:scale-105 hover:rotate-3">
            S
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            QuinTron Breath Test
          </h1>
          <p className="text-sm text-slate-500">Specter Clinical Platform</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          {error && (
            <div className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          Authorized hospital personnel only. Activity is audited.
        </p>
      </div>
    </div>
  );
}
