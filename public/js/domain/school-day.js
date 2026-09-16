// Which school day the "Heute" screen should show.
//
// Once the school day is over, today's plan stops being the useful answer —
// what you want then is what to pack for tomorrow. So after a cutoff time
// (17:00 by default, configurable) the screen rolls forward:
//
//   Mon-Thu, after the cutoff  -> tomorrow
//   Fri, after the cutoff      -> Monday (skip the weekend)
//   Sat / Sun, any time        -> Monday
//
// Holidays (the timetable's `no_school_dates`) are skipped the same way, so
// the Friday before an autumn break lands on the Monday school actually
// resumes rather than on an empty day.
//
// Pure date arithmetic, no storage or DOM, so the rules can be unit-tested
// across every weekday and both sides of the cutoff.

const FRIDAY = 5;
const SATURDAY = 6;
const SUNDAY = 7;

export const DEFAULT_CUTOFF_HOUR = 17;
export const CUTOFF_HOUR_OPTIONS = [16, 17, 18, 19, 20];

// How far to look for the next day with lessons. Three weeks clears the real
// breaks in a German school year — a two-week autumn or winter break plus the
// weekends bracketing it already needs 15 days, so a fortnight's worth of
// lookahead silently fails on exactly the case this exists for. The summer
// holidays stay out of reach on purpose: jumping six weeks ahead is less
// honest than showing the empty day you're actually in.
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
 * Local-time YYYY-MM-DD. Deliberately not reusing data/repository.js's
 * isoDate(): this module stays free of the data layer so it can be tested
 * (and reasoned about) on its own. toISOString() is wrong here — it would
 * shift the date by the UTC offset late in the evening, which is exactly
 * when this code runs.
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
    // The weekend has no plan of its own; Monday is the next thing that matters.
    candidate = addDays(today, 2);
  } else if (weekday === SUNDAY) {
    candidate = addDays(today, 1);
  } else if (now.getHours() < cutoffHour) {
    candidate = today;
  } else {
    // Past the cutoff: Friday jumps the weekend, everything else is tomorrow.
    candidate = addDays(today, weekday === FRIDAY ? 3 : 1);
  }

  return skipNonSchoolDays(candidate, noSchoolDates);
}

/**
 * Walks forward off weekends and holidays. Also applies when the candidate is
 * *today*: sitting on a holiday, the next day with lessons is more use than
 * an empty one. Gives up after MAX_LOOKAHEAD_DAYS and returns the original
 * candidate, so a long break shows an empty day rather than a date weeks away.
 */
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
 * "Heute" / "Morgen" / the weekday name — the heading has to stay honest
 * about which day is on screen once it can roll forward.
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
