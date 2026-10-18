import { isPoolExhausted } from "./prisma";

// -----------------------------------------------------------------------------
// Turn a caught error into text that is safe and useful to show a user.
//
// Our own business-rule errors (plain `Error`, e.g. "A hospital with code X
// already exists") are written for users and pass through unchanged. Database
// driver errors are not: they contain query details and wording like
// "max clients are limited to pool_size: 15" that users misread. Those are
// logged server-side and replaced with a plain message.
// -----------------------------------------------------------------------------

const BUSY = "The system is busy right now. Please wait a few seconds and try again.";

export function userMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;

  const name = err.name ?? "";
  if (name.startsWith("PrismaClient") || isPoolExhausted(err)) {
    console.error("[db]", err);
    const transient =
      isPoolExhausted(err) ||
      name === "PrismaClientInitializationError" ||
      /Can't reach database server|Timed out|Connection reset|Closed the connection/.test(err.message);
    return transient ? BUSY : fallback;
  }

  // Schema validation errors carry a JSON dump as their message.
  if (name === "ZodError") {
    const first = (err as Error & { issues?: Array<{ message?: string }> }).issues?.[0]?.message;
    return first || fallback;
  }

  return err.message || fallback;
}
