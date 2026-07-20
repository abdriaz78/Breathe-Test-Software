import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listActiveTimers } from "@/lib/timers";

// Polled by the header timer widget (see src/components/TimerProvider.tsx).
// `serverNow` lets the client correct for clock skew between the workstation
// and the server, since all due times are computed server-side.
//
// Uses auth() rather than requireUser() so an unauthenticated poll (e.g. the
// login page) gets a clean 401 instead of a redirect to an HTML page.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const timers = await listActiveTimers({
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  });

  return NextResponse.json(
    { timers, serverNow: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
