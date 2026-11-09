import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listActiveTimers } from "@/lib/timers";
import { staffFromSession } from "@/lib/session";

// Polled by the header timer widget (see src/components/TimerProvider.tsx).
// `serverNow` lets the client correct for clock skew between the workstation
// and the server, since all due times are computed server-side.
//
// Uses auth() rather than requireUser() so an unauthenticated poll (e.g. the
// login page) gets a clean 401 instead of a redirect to an HTML page.
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = staffFromSession(await auth());
  if (!actor) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const timers = await listActiveTimers(actor);

  return NextResponse.json(
    { timers, serverNow: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
