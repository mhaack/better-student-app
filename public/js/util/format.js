const WEEKDAY_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

function daysFromToday(date) {
  return Math.round((date - startOfToday()) / 86_400_000);
}

/** Whole days from today to `iso` (negative if in the past), or null if `iso` is falsy. */
export function daysUntil(iso) {
  return iso ? daysFromToday(new Date(iso)) : null;
}

/** Calendar days between two "YYYY-MM-DD" dates; in UTC so DST days count as one. */
export function calendarDaysBetween(fromIso, toIso) {
  const utc = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000);
}

/** [3] -> "3. Stunde"; [1,2] -> "1.–2. Stunde"; [1,3] -> "1., 3. Stunde". */
export function periodLabel(periods) {
  if (!periods.length) return "";
  if (periods.length === 1) return `${periods[0]}. Stunde`;
  const isRun = periods.at(-1) - periods[0] === periods.length - 1;
  return isRun
    ? `${periods[0]}.–${periods.at(-1)}. Stunde`
    : `${periods.map((p) => `${p}.`).join(", ")} Stunde`;
}

/** "Heute" / "Morgen" / "In 3 Tagen", and "Gestern" / "Vor 3 Tagen" looking back. */
export function countdownLabel(days) {
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  if (days === -1) return "Gestern";
  return days > 0 ? `In ${days} Tagen` : `Vor ${-days} Tagen`;
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

/**
 * "23.09.2026", for dates that may be months old. Parsed as local time:
 * new Date("2026-09-23") is UTC midnight.
 */
export function formatFullDate(iso) {
  const [y, m, d] = String(iso ?? "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return FULL_DATE_FORMAT.format(new Date(y, m - 1, d));
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

/** The overall average: 2 decimals on grade_1_6 ("2,31"). */
export function formatOverallAverage(value, scale) {
  if (value === null || value === undefined) return "–";
  return scale === "points_0_15"
    ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
