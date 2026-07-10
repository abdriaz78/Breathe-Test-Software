// Pure, dependency-free sample calculations. Safe to import from both client
// and server components (no next/headers, prisma, or other server-only code).

/** H2 + CH4 total. Null only if BOTH are null; a present value treats the other
 * as 0 so a partial entry still totals sensibly. */
export function sampleTotal(
  h2: number | null | undefined,
  ch4: number | null | undefined
): number | null {
  if (h2 == null && ch4 == null) return null;
  return (h2 ?? 0) + (ch4 ?? 0);
}
