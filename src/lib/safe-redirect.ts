/**
 * Returns `raw` only if it is a same-origin relative path ("/tests?x=1"),
 * otherwise `fallback`. Rejects absolute URLs, protocol-relative "//host"
 * and backslash tricks ("/\host") that browsers treat as another origin.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  // Patients are never sent into the staff app via a callback, and vice versa.
  if (raw === "/portal" || raw.startsWith("/portal/")) return fallback;
  return raw;
}
