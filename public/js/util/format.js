const WEEKDAY_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });

function daysFromToday(date) {
  return Math.round((date - startOfToday()) / 86_400_000);
}

/** Whole days from today to `iso` (negative if in the past), or null if `iso` is falsy. */
export function daysUntil(iso) {
  return iso ? daysFromToday(new Date(iso)) : null;
}

/** "Heute"/"Morgen" for the next two days, "Montag" through day 6, otherwise "12.09." */
export function weekdayOrDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const days = daysFromToday(date);
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  if (days >= 0 && days < 7) return WEEKDAY_FORMAT.format(date);
  return SHORT_DATE_FORMAT.format(date);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatAverage(value, scale) {
  if (value === null || value === undefined) return "–";
  return scale === "points_0_15"
    ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/** The overall average always shows 2 decimals on the grade_1_6 scale, matching the design's "2,31". */
export function formatOverallAverage(value, scale) {
  if (value === null || value === undefined) return "–";
  return scale === "points_0_15"
    ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
