// -----------------------------------------------------------------------------
// Wall-clock time helpers for sample collection times.
//
// Storage is a standard 24-hour "HH:mm" string (e.g. "13:30"); display is a
// friendly 12-hour string (e.g. "1:30 PM"). parseClockInput is forgiving so a
// technician can type "1330", "130", "1:30 pm", "9a" etc. and get a normalized
// value back.
// -----------------------------------------------------------------------------

/**
 * Parse a loosely-typed clock entry into standard 24h "HH:mm", or null if the
 * input is empty or cannot be understood.
 *
 * Accepts: "1330", "133", "13:30", "1:30 PM", "130p", "9", "9am", "0930"…
 */
export function parseClockInput(raw: string): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  // Detect an am/pm marker anywhere in the string.
  let meridiem: "am" | "pm" | null = null;
  if (/p/.test(trimmed)) meridiem = "pm";
  else if (/a/.test(trimmed)) meridiem = "am";

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let hours: number;
  let minutes: number;
  if (digits.length <= 2) {
    hours = parseInt(digits, 10);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = parseInt(digits.slice(0, 1), 10);
    minutes = parseInt(digits.slice(1), 10);
  } else {
    // Use the last 4 digits (guards against stray extra input).
    const d = digits.slice(-4);
    hours = parseInt(d.slice(0, 2), 10);
    minutes = parseInt(d.slice(2), 10);
  }

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (minutes > 59) return null;

  if (meridiem === "pm" && hours < 12) hours += 12;
  else if (meridiem === "am" && hours === 12) hours = 0;

  if (hours > 23) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Format a standard 24h "HH:mm" value as friendly 12h "1:30 PM". */
export function formatClock12(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return value;
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
}
