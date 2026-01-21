export const EASTERN_TZ = "America/New_York";

// If we receive a date-only string like "YYYY-MM-DD", JavaScript parses it as UTC midnight.
// When formatting in America/New_York, that can display as the *previous day*.
// To keep date-only values stable in Eastern, convert them to a Date at **noon UTC**.
function coerceDate(dateLike) {
  if (!dateLike) return null;

  // Keep Date instances and timestamps as-is.
  if (dateLike instanceof Date) return dateLike;
  if (typeof dateLike === "number") return new Date(dateLike);

  if (typeof dateLike === "string") {
    // Detect date-only ISO format.
    const m = dateLike.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      // Noon UTC avoids the Eastern date rolling to the prior day.
      return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    }
  }

  return new Date(dateLike);
}

export function formatDateEastern(dateLike = new Date()) {
  if (!dateLike) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(coerceDate(dateLike));
  } catch {
    return "";
  }
}

export function formatTimeEastern(dateLike) {
  if (!dateLike) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TZ,
      hour: "2-digit",
      minute: "2-digit"
    }).format(coerceDate(dateLike));
  } catch {
    return "—";
  }
}

export function formatDateTimeEastern(dateLike) {
  if (!dateLike) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(coerceDate(dateLike));
  } catch {
    return "—";
  }
}
