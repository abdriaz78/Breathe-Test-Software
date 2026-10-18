import { PrismaClient } from "@prisma/client";

// -----------------------------------------------------------------------------
// Prisma client with a transient-error retry wrapper.
//
// Managed Postgres poolers (e.g. Supabase) drop idle connections, and some
// networks have a flaky IPv6 path, so the FIRST query after an idle period can
// fail once with "Can't reach database server" even when the DB is healthy.
// We retry such transient connection errors a few times with small backoff so
// these blips never surface to the user (e.g. a failed login).
//
// The Supabase session pooler also caps total clients (pool_size, 15 on this
// project). Prisma's default pool is cpu_count * 2 + 1 connections per process,
// so two servers could exhaust it. We therefore cap each process's pool (see
// withConnectionLimit) and treat "max clients reached" as transient too.
// -----------------------------------------------------------------------------

/** Per-process pool cap when DATABASE_URL doesn't set one. Override with
 * DATABASE_CONNECTION_LIMIT. On Vercel every serverless instance is its own
 * process, so each gets a single connection (Prisma's serverless guidance). */
const DEFAULT_CONNECTION_LIMIT = process.env.VERCEL ? 1 : 5;

function withConnectionLimit(url: string | undefined): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  const limit = Number(process.env.DATABASE_CONNECTION_LIMIT) || DEFAULT_CONNECTION_LIMIT;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${limit}`;
}

/** The pooler refused us because every client slot is taken. */
export function isPoolExhausted(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? "");
  return msg.includes("EMAXCONN") || msg.includes("max clients reached");
}

const TRANSIENT_CODES = new Set(["P1000", "P1001", "P1002", "P1008", "P1017"]);

function isTransient(err: unknown): boolean {
  const e = err as { name?: string; code?: string; message?: string };
  if (e?.name === "PrismaClientInitializationError") return true;
  if (e?.code && TRANSIENT_CODES.has(e.code)) return true;
  const msg = String(e?.message ?? "");
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("Connection reset") ||
    msg.includes("Closed the connection") ||
    msg.includes("Timed out") ||
    isPoolExhausted(err)
  );
}

function createPrisma() {
  const client = new PrismaClient({
    datasourceUrl: withConnectionLimit(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastErr: unknown;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastErr = err;
            if (!isTransient(err) || attempt === 3) throw err;
            // A full pool needs longer to free a slot than a dropped connection.
            const step = isPoolExhausted(err) ? 750 : 250;
            await new Promise((r) => setTimeout(r, step * (attempt + 1)));
          }
        }
        throw lastErr;
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof createPrisma>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
