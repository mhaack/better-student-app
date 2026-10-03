// Which school day "Heute" shows. After the cutoff (default 17:00) it rolls
// forward to the next school day, skipping weekends and `no_school_dates`.

const FRIDAY = 5;
const SATURDAY = 6;
const SUNDAY = 7;

export const DEFAULT_CUTOFF_HOUR = 17;
export const CUTOFF_HOUR_OPTIONS = [16, 17, 18, 19, 20];

// Clears a two-week break plus its weekends (15 days); the summer break is
// out of reach on purpose, an empty day is more honest than six weeks ahead.
const MAX_LOOKAHEAD_DAYS = 21;

/** 1 = Monday … 7 = Sunday, matching the API's own weekday numbering. */
function isoWeekday(date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function atMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Local-time YYYY-MM-DD. Not toISOString(): the UTC offset would shift the
 * date late in the evening, exactly when this runs.
 */
function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * @param {Date} now
 * @param {number} [cutoffHour] hour of day (16-20) after which we roll forward
 * @param {string[]} [noSchoolDates] YYYY-MM-DD holidays from the timetable
 * @returns {Date} midnight on the school day to display
 */
export function resolveSchoolDay(now, cutoffHour = DEFAULT_CUTOFF_HOUR, noSchoolDates = []) {
  const today = atMidnight(now);
  const weekday = isoWeekday(now);

  let candidate;
  if (weekday === SATURDAY) {
    candidate = addDays(today, 2);
  } else if (weekday === SUNDAY) {
    candidate = addDays(today, 1);
  } else if (now.getHours() < cutoffHour) {
    candidate = today;
  } else {
    candidate = addDays(today, weekday === FRIDAY ? 3 : 1);
  }

  return skipNonSchoolDays(candidate, noSchoolDates);
}

/** Walks forward off weekends and holidays; gives up after MAX_LOOKAHEAD_DAYS. */
function skipNonSchoolDays(candidate, noSchoolDates) {
  const closed = new Set(noSchoolDates ?? []);
  let day = candidate;

  for (let i = 0; i < MAX_LOOKAHEAD_DAYS; i++) {
    const weekday = isoWeekday(day);
    if (weekday !== SATURDAY && weekday !== SUNDAY && !closed.has(toIsoDate(day))) return day;
    day = addDays(day, 1);
  }

  return candidate;
}

/**
 * "Heute" / "Morgen" / the weekday name.
 * @param {Date} target midnight on the day being shown
 * @param {Date} now
 */
export function schoolDayLabel(target, now) {
  const today = atMidnight(now);
  const diffDays = Math.round((target - today) / 86_400_000);
  if (diffDays <= 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(target);
}
