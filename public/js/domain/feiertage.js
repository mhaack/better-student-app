// Names for German public holidays, computed rather than fetched.
//
// The Schulferien service (api/schulferien.js) covers Ferien but not
// Feiertage, so a single free day like Buß- und Bettag comes back from it as
// "not a holiday" even though school is shut. Measured against this school's
// calendar, two of its 54 closed days are exactly that case.
//
// Every movable German holiday hangs off Easter, and Easter is computable, so
// this needs no network, no table to maintain, and works for any year —
// which matters for an offline-capable app.
//
// The list is *national*. A few entries here are state-specific
// (Fronleichnam, Reformationstag, Buß- und Bettag), but these names only ever
// label days the school has already told us are free, so a holiday that
// doesn't apply locally is simply never looked up. The failure mode is a
// mislabel, never a phantom day off.

/** Gauss's Easter algorithm. Returns Easter Sunday as a UTC date. */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoUtc(date) {
  return date.toISOString().slice(0, 10);
}

function plusDays(date, days) {
  return isoUtc(new Date(date.getTime() + days * 86_400_000));
}

/**
 * Buß- und Bettag: the Wednesday before 23 November. When the 23rd is itself
 * a Wednesday the holiday is the *previous* week, hence the `|| 7`.
 */
function bussUndBettag(year) {
  const nov23 = new Date(Date.UTC(year, 10, 23));
  const backToWednesday = ((nov23.getUTCDay() - 3) + 7) % 7 || 7;
  return plusDays(nov23, -backToWednesday);
}

/**
 * @param {number} year
 * @returns {Record<string, string>} YYYY-MM-DD -> name
 */
export function holidayNames(year) {
  const easter = easterSunday(year);
  return {
    [`${year}-01-01`]: "Neujahr",
    [`${year}-05-01`]: "Tag der Arbeit",
    [`${year}-10-03`]: "Tag der Deutschen Einheit",
    [`${year}-10-31`]: "Reformationstag",
    [`${year}-12-25`]: "1. Weihnachtsfeiertag",
    [`${year}-12-26`]: "2. Weihnachtsfeiertag",
    [plusDays(easter, -48)]: "Rosenmontag",
    [plusDays(easter, -2)]: "Karfreitag",
    [plusDays(easter, 1)]: "Ostermontag",
    [plusDays(easter, 39)]: "Christi Himmelfahrt",
    [plusDays(easter, 50)]: "Pfingstmontag",
    [plusDays(easter, 60)]: "Fronleichnam",
    [bussUndBettag(year)]: "Buß- und Bettag",
  };
}

/**
 * The name for one date, or undefined. Undefined is a real answer here —
 * a Brückentag has no national name and must render as "Schulfrei" rather
 * than as a guess.
 * @param {string} iso YYYY-MM-DD
 */
export function feiertagName(iso) {
  if (!iso) return undefined;
  return holidayNames(Number(iso.slice(0, 4)))[iso];
}
