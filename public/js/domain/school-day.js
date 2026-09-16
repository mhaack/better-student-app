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
// Pure date arithmetic, no storage or DOM, so the rules can be unit-tested
// across every weekday and both sides of the cutoff.

const FRIDAY = 5;
const SATURDAY = 6;
const SUNDAY = 7;

export const DEFAULT_CUTOFF_HOUR = 17;
export const CUTOFF_HOUR_OPTIONS = [16, 17, 18, 19, 20];

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
 * @param {Date} now
 * @param {number} [cutoffHour] hour of day (16-20) after which we roll forward
 * @returns {Date} midnight on the school day to display
 */
export function resolveSchoolDay(now, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const today = atMidnight(now);
  const weekday = isoWeekday(now);

  // The weekend has no plan of its own; Monday is the next thing that matters.
  if (weekday === SATURDAY) return addDays(today, 2);
  if (weekday === SUNDAY) return addDays(today, 1);

  if (now.getHours() < cutoffHour) return today;

  // Past the cutoff: Friday jumps the weekend, everything else is tomorrow.
  return addDays(today, weekday === FRIDAY ? 3 : 1);
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
