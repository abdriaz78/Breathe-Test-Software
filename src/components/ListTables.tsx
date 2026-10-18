"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { ReportStatus } from "@prisma/client";
import { Icon } from "@/components/ui/Icon";
import { Avatar, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { TestRowTimer } from "@/components/TestRowTimer";

// Paged, searchable lists. Paging and search run on the server (see
// listPatientsPage / listTestsPage), so every record is reachable no matter how
// many exist. State lives in the URL (?q=…&page=…), so links and the back
// button work as expected.

export interface PageInfo {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

/** Current URL with some params replaced (null removes the param). */
function useHrefWith() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

function SearchBox({ placeholder, info }: { placeholder: string; info: PageInfo }) {
  const router = useRouter();
  const params = useSearchParams();
  const hrefWith = useHrefWith();
  const urlQ = params.get("q") ?? "";
  const [value, setValue] = useState(urlQ);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync when the URL changes elsewhere (back button, Clear),
  // without clobbering in-progress typing such as a trailing space.
  useEffect(() => setValue((v) => (v.trim() === urlQ ? v : urlQ)), [urlQ]);

  function onChange(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    // Wait until typing pauses, then search on the server from page 1.
    timer.current = setTimeout(() => {
      startTransition(() => router.replace(hrefWith({ q: v.trim() || null, page: null }), { scroll: false }));
    }, 350);
  }

  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input pl-9 pr-9"
          aria-label={placeholder}
        />
        {pending && (
          <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-label="Searching" />
        )}
      </div>
      <p className="text-xs font-medium text-slate-400 tabular-nums">
        {urlQ ? `${info.total} match${info.total === 1 ? "" : "es"}` : `${info.total} total`}
      </p>
    </div>
  );
}

/** Page numbers to show: first, last, current ±1, with gaps as null. */
function pageList(page: number, count: number): Array<number | null> {
  const want = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count));
  const sorted = [...want].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

function Pager({ info }: { info: PageInfo }) {
  const hrefWith = useHrefWith();
  if (info.total === 0) return null;
  const from = (info.page - 1) * info.pageSize + 1;
  const to = Math.min(info.page * info.pageSize, info.total);
  const href = (p: number) => hrefWith({ page: p === 1 ? null : String(p) });
  const btn = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row">
      <p className="text-sm text-slate-500 tabular-nums">
        Showing <span className="font-semibold text-slate-800">{from}–{to}</span> of{" "}
        <span className="font-semibold text-slate-800">{info.total}</span>
      </p>
      {info.pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pages">
          {info.page > 1 ? (
            <Link href={href(info.page - 1)} scroll={false} className={`${btn} text-slate-600 hover:bg-slate-100`} aria-label="Previous page">
              <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
            </Link>
          ) : (
            <span className={`${btn} text-slate-300`} aria-hidden><Icon name="chevronRight" className="h-4 w-4 rotate-180" /></span>
          )}
          {pageList(info.page, info.pageCount).map((n, i) =>
            n === null ? (
              <span key={`gap${i}`} className="px-1 text-slate-400">…</span>
            ) : n === info.page ? (
              <span key={n} aria-current="page" className={`${btn} bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-glow tabular-nums`}>{n}</span>
            ) : (
              <Link key={n} href={href(n)} scroll={false} className={`${btn} text-slate-600 tabular-nums hover:bg-slate-100`}>{n}</Link>
            )
          )}
          {info.page < info.pageCount ? (
            <Link href={href(info.page + 1)} scroll={false} className={`${btn} text-slate-600 hover:bg-slate-100`} aria-label="Next page">
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
          ) : (
            <span className={`${btn} text-slate-300`} aria-hidden><Icon name="chevronRight" className="h-4 w-4" /></span>
          )}
        </nav>
      )}
    </div>
  );
}

function NoMatches({ what }: { what: string }) {
  const params = useSearchParams();
  const hrefWith = useHrefWith();
  return (
    <EmptyState
      icon="search"
      title={`No ${what} match “${params.get("q") ?? ""}”`}
      description="Try part of the name, the MRN, or a different spelling."
      action={<Link href={hrefWith({ q: null, page: null })} className="btn-secondary"><Icon name="x" className="h-4 w-4" /> Clear search</Link>}
    />
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ------------------------------------------------------------------ patients

export interface PatientRow {
  id: string;
  mrn: string;
  name: string;
  gender: string;
  hospitalName: string;
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Undisclosed",
};

export function PatientsTable({
  rows,
  info,
  emptyAction,
}: {
  rows: PatientRow[];
  info: PageInfo;
  emptyAction?: ReactNode;
}) {
  const searching = Boolean(useSearchParams().get("q"));
  return (
    <div className="table-shell animate-fade-in-up">
      <SearchBox placeholder="Search by name, MRN or hospital…" info={info} />
      {rows.length === 0 ? (
        searching ? <NoMatches what="patients" /> : (
          <EmptyState icon="users" title="No patients registered yet" description="Registered patients will appear here." action={emptyAction} />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Patient</th>
                <th>MRN</th>
                <th className="hidden md:table-cell">Gender</th>
                <th className="hidden lg:table-cell">Hospital</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="group">
                  <td>
                    <Link href={`/patients/${p.id}`} className="flex items-center gap-3">
                      <Avatar name={p.name} size="sm" />
                      <span className="font-semibold text-slate-900 group-hover:text-brand-700">{p.name}</span>
                    </Link>
                  </td>
                  <td><span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{p.mrn}</span></td>
                  <td className="hidden text-slate-600 md:table-cell">{GENDER_LABEL[p.gender] ?? p.gender}</td>
                  <td className="hidden text-slate-600 lg:table-cell">
                    <span className="inline-flex items-center gap-1.5"><Icon name="building" className="h-3.5 w-3.5 text-slate-400" />{p.hospitalName}</span>
                  </td>
                  <td className="text-right">
                    <Link href={`/patients/${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 opacity-70 transition-all hover:bg-brand-50 group-hover:opacity-100">
                      View <Icon name="chevronRight" className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager info={info} />
    </div>
  );
}

// --------------------------------------------------------------------- tests

export interface TestRow {
  id: string;
  patientName: string;
  patientMrn: string;
  testTypeName: string;
  status: ReportStatus;
  collectionDate: string | null;
}

export function TestsTable({
  rows,
  info,
  emptyAction,
}: {
  rows: TestRow[];
  info: PageInfo;
  emptyAction?: ReactNode;
}) {
  const searching = Boolean(useSearchParams().get("q"));
  return (
    <div className="table-shell animate-fade-in-up">
      <SearchBox placeholder="Search patient, MRN or test type…" info={info} />
      {rows.length === 0 ? (
        searching ? <NoMatches what="tests" /> : (
          <EmptyState icon="flask" title="No breath tests found" description="Tests matching this filter will appear here." action={emptyAction} />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Patient</th>
                <th className="hidden sm:table-cell">Test type</th>
                <th className="hidden md:table-cell">Collection</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="group">
                  <td>
                    <Link href={`/tests/${t.id}`} className="flex items-center gap-3">
                      <Avatar name={t.patientName} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900 group-hover:text-brand-700">{t.patientName}</span>
                        <span className="block font-mono text-xs text-slate-500">{t.patientMrn}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-slate-700"><Icon name="flask" className="h-3.5 w-3.5 text-brand-500" />{t.testTypeName}</span>
                  </td>
                  <td className="hidden text-slate-600 md:table-cell">
                    <span className="inline-flex items-center gap-1.5"><Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />{fmtDate(t.collectionDate)}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <StatusBadge status={t.status} />
                    <TestRowTimer testId={t.id} />
                  </td>
                  <td className="text-right">
                    <Link href={`/tests/${t.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 opacity-70 transition-all hover:bg-brand-50 group-hover:opacity-100">
                      Open <Icon name="chevronRight" className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager info={info} />
    </div>
  );
}
