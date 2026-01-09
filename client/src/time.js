export const EASTERN_TZ = "America/New_York";

export function formatDateEastern(dateLike = new Date()) {
  if (!dateLike) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(dateLike));
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
    }).format(new Date(dateLike));
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
    }).format(new Date(dateLike));
  } catch {
    return "—";
  }
}
