import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// -----------------------------------------------------------------------------
// Edge gate in front of every route. Coarse only — fine-grained RBAC and
// hospital scoping are enforced server-side on every read/write. This layer:
//
//   * lets public assets through (login pages, PWA manifest / service worker /
//     icons / offline page, NextAuth's own API);
//   * requires a session everywhere else (staff -> /login, portal -> /portal/login);
//   * fences the two session kinds apart: a patient-portal session can only
//     reach /portal and /api/portal, and a staff session cannot use the portal.
// -----------------------------------------------------------------------------

const PUBLIC_PATHS = new Set([
  "/login",
  "/portal/login",
  "/offline.html",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon.svg",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/robots.txt",
]);
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/icons/"];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

function isPortal(path: string): boolean {
  return path === "/portal" || path.startsWith("/portal/") || path.startsWith("/api/portal/");
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isApi = path.startsWith("/api/");
  const portal = isPortal(path);

  if (!token) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = portal ? "/portal/login" : "/login";
    url.search = "";
    if (!portal) url.searchParams.set("callbackUrl", path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  const isPatient = token.kind === "patient";
  if (isPatient && !portal) {
    if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.redirect(new URL("/portal", req.url));
  }
  if (!isPatient && portal) {
    if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
