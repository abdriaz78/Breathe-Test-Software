export { default } from "next-auth/middleware";

// Protect the whole app except the login page, auth API, and static assets.
// Fine-grained RBAC is enforced per-action server-side; this just requires a
// valid session to reach any app route.
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|specter-logo.svg).*)",
  ],
};
