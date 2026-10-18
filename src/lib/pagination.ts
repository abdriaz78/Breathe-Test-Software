// -----------------------------------------------------------------------------
// Page-by-page listing helpers shared by the patients and tests lists.
//
// Patient names are encrypted at rest, so the database cannot search them.
// Searches therefore decrypt the actor's (hospital-scoped) records in memory
// and filter there; plain listings page directly in the database.
// -----------------------------------------------------------------------------

export const PAGE_SIZE = 25;

export interface Page<T> {
  rows: T[];
  total: number;
  page: number; // 1-based, clamped to the available range
  pageCount: number;
  pageSize: number;
}

/** Parse a `?page=` value; anything invalid becomes page 1. */
export function parsePage(raw: string | undefined | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function pageCountFor(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Clamp a requested page into range and return its row offset. */
export function pageWindow(total: number, requested: number, pageSize = PAGE_SIZE) {
  const pageCount = pageCountFor(total, pageSize);
  const page = Math.min(Math.max(1, requested), pageCount);
  return { page, pageCount, skip: (page - 1) * pageSize };
}

/** Paginate an in-memory list (used after decrypt-and-filter searches). */
export function paginate<T>(all: T[], requested: number, pageSize = PAGE_SIZE): Page<T> {
  const { page, pageCount, skip } = pageWindow(all.length, requested, pageSize);
  return { rows: all.slice(skip, skip + pageSize), total: all.length, page, pageCount, pageSize };
}

/** Case-insensitive "contains" across several fields. */
export function matchesQuery(q: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}
