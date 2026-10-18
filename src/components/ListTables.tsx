"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { ReportStatus } from "@prisma/client";
import { Icon } from "@/components/ui/Icon";
import { Avatar, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { TestRowTimer } from "@/components/TestRowTimer";

// Instant client-side filtering over rows the server already loaded (and
// already scoped to the viewer's hospital). Names are encrypted at rest, so the
// server can only search by exact MRN — this box covers name/type lookups.

function SearchBox({
  value,
  onChange,
  placeholder,
  count,
  total,
  available,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  count: number;
  total: number;
  /** Total matching records on the server, when more exist than were loaded. */
  available?: number;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input pl-9"
          aria-label={placeholder}
        />
      </div>
      <p className="text-xs font-medium text-slate-400 tabular-nums">
        {value
          ? `${count} of ${total} shown`
          : available && available > total
            ? `Latest ${total} of ${available}`
            : `${total} total`}
      </p>
    </div>
  );
}

function matches(q: string, ...fields: Array<string | null | undefined>) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
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
  emptyAction,
  emptyTitle = "No patients registered yet",
}: {
  rows: PatientRow[];
  emptyAction?: ReactNode;
  emptyTitle?: string;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => rows.filter((p) => matches(q, p.name, p.mrn, p.hospitalName)), [rows, q]);

  return (
    <div className="table-shell animate-fade-in-up">
      <SearchBox value={q} onChange={setQ} placeholder="Search by name, MRN or hospital…" count={shown.length} total={rows.length} />
      {rows.length === 0 ? (
        <EmptyState icon="users" title={emptyTitle} description="Registered patients will appear here." action={emptyAction} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="search"
          title="No matches on this page"
          description="Names are encrypted, so only the loaded records can be searched by name. You can look up any record by its exact MRN."
          action={
            <Link href={`/patients?mrn=${encodeURIComponent(q.trim())}`} className="btn-secondary">
              <Icon name="search" className="h-4 w-4" /> Look up MRN “{q.trim()}”
            </Link>
          }
        />
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
              {shown.map((p) => (
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
  emptyAction,
  available,
}: {
  rows: TestRow[];
  emptyAction?: ReactNode;
  available?: number;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => rows.filter((t) => matches(q, t.patientName, t.patientMrn, t.testTypeName)), [rows, q]);

  return (
    <div className="table-shell animate-fade-in-up">
      <SearchBox value={q} onChange={setQ} placeholder="Search patient, MRN or test type…" count={shown.length} total={rows.length} available={available} />
      {rows.length === 0 ? (
        <EmptyState icon="flask" title="No breath tests found" description="Tests matching this filter will appear here." action={emptyAction} />
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title="No matching tests" description="Try a different name, MRN or test type." />
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
              {shown.map((t) => (
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
    </div>
  );
}
