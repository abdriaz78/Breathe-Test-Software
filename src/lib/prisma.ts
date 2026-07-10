import { PrismaClient } from "@prisma/client";

// -----------------------------------------------------------------------------
// Prisma client with a transient-error retry wrapper.
//
// Managed Postgres poolers (e.g. Supabase) drop idle connections, and some
// networks have a flaky IPv6 path, so the FIRST query after an idle period can
// fail once with "Can't reach database server" even when the DB is healthy.
// We retry such transient connection errors a few times with small backoff so
// these blips never surface to the user (e.g. a failed login).
// -----------------------------------------------------------------------------

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
    msg.includes("Timed out")
  );
}

function createPrisma() {
  const client = new PrismaClient({
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
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
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
