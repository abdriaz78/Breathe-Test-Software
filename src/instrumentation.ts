// Runs once at server startup (Next.js instrumentation hook).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Prefer IPv4 when resolving hostnames. Some networks have a broken IPv6
    // path to managed Postgres (e.g. Supabase's pooler), which makes Node
    // intermittently pick an unreachable AAAA record and fail to connect.
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
