const WEEKDAY_FORMATS = {
  short: new Intl.DateTimeFormat("de-DE", { weekday: "short" }),
  long: new Intl.DateTimeFormat("de-DE", { weekday: "long" }),
};
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

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
  if (days >= 0 && days < 7) return formatWeekday(iso, "long");
  return SHORT_DATE_FORMAT.format(date);
}

/**
 * The calendar day of "2026-09-23" (a time after it is ignored) as local
 * midnight; new Date("2026-09-23") would be UTC midnight. Null if unparseable.
 */
function localDate(iso) {
  const [y, m, d] = String(iso ?? "").slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** "23.09.26", for dates that may be months old. */
export function formatFullDate(iso) {
  const date = localDate(iso);
  return date ? FULL_DATE_FORMAT.format(date) : "";
}

/** "Fr" (Intl's trailing dot dropped) or, with "long", "Freitag". */
export function formatWeekday(iso, length = "short") {
  const date = localDate(iso);
  return date ? WEEKDAY_FORMATS[length].format(date).replace(".", "") : "";
}

/** "9.11.", unpadded like the Stundenplan's day headers. */
export function formatDayMonth(iso) {
  const date = localDate(iso);
  return date ? `${date.getDate()}.${date.getMonth() + 1}.` : "";
}

/** "November 2026" */
export function formatMonthYear(iso) {
  const date = localDate(iso);
  return date ? MONTH_YEAR_FORMAT.format(date) : "";
}

/** "Fr 19.09.25" */
export function formatWeekdayDate(iso) {
  const full = formatFullDate(iso);
  return full ? `${formatWeekday(iso)} ${full}` : "";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** " P" after an Oberstufe value; nothing for Noten or a missing value ("–"). */
export function scaleUnit(scale, value) {
  return scale === "points_0_15" && value !== null && value !== undefined ? " P" : "";
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
