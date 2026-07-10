// -----------------------------------------------------------------------------
// Pure CSV builder (RFC 4180). Values containing comma, quote, or newline are
// wrapped in quotes with quotes doubled. Output uses CRLF line endings and a
// UTF-8 BOM so Excel opens non-ASCII text (e.g. Arabic names) correctly.
// -----------------------------------------------------------------------------

export type CsvCell = string | number | boolean | null | undefined;

const BOM = "﻿";

function escapeCell(value: CsvCell): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Build an HTTP Response that downloads a CSV file. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
