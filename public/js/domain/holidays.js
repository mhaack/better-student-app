// Turns the timetable's flat list of closed dates into named holiday blocks.
//
// `no_school_dates` is a bare string[] of YYYY-MM-DD, weekdays only —
// weekends are never listed, because they are implicitly not school days.
// That has one consequence worth stating up front: grouping strictly by
// consecutive calendar days splits a two-week break into two five-day
// blocks, so the merge has to bridge weekends.
//
// It carries no names at all, and it is not always complete: measured
// against the official state calendar, this school recorded 15 of the 30
// weekdays of the 2027 summer break. So names *and* true ranges come from
// api/schulferien.js where available, with a local heuristic as the offline
// fallback. See docs/plans/termine.md for the measurements.
//
// Pure date arithmetic, no storage, no network.

import { feiertagName } from "./feiertage.js";

const SATURDAY = 6;
const SUNDAY = 0;

// Below this, a block is a public holiday or a Brückentag rather than Ferien.
// Counted in school days, which is what the UI shows ("10 Schultage frei").
export const MIN_FERIEN_SCHOOL_DAYS = 5;

// June is ambiguous: a week is Pfingsten, six weeks is an early summer break
// (NRW, Niedersachsen). Length is the only thing that separates them.
const SOMMER_MIN_SCHOOL_DAYS = 15;

function isWeekend(iso) {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === SATURDAY || day === SUNDAY;
}

function addDays(iso, days) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * True when every day strictly between `from` and `to` is a weekend — the
 * condition for treating them as one continuous break. Looks at most three
 * days ahead, which covers Fri→Mon; anything longer means school happened
 * in between.
 */
function onlyWeekendBetween(from, to) {
  for (let offset = 1; offset <= 3; offset++) {
    const day = addDays(from, offset);
    if (day === to) return true;
    if (!isWeekend(day)) return false;
  }
  return false;
}

/** Which official range a date belongs to, as a comparable identity. */
function officialKeyFor(date, officialFerien) {
  const match = officialFerien.find((f) => date >= f.from && date <= f.to);
  return match ? `${match.name}|${match.from}` : null;
}

/**
 * Groups closed dates into blocks, bridging weekends.
 *
 * Adjacent days are only merged when they are the same *kind* of free day.
 * Without that, 2027-05-06 (Christi Himmelfahrt, a public holiday) and
 * 2027-05-07 (officially Pfingstferien) collapse into one nameless two-day
 * block, and both names are lost. Passing the official calendar in lets the
 * boundary split the block instead.
 *
 * @param {string[]} noSchoolDates
 * @param {{name: string, from: string, to: string}[]} [officialFerien]
 * @returns {{from: string, to: string, schoolDays: number}[]}
 */
export function holidayBlocks(noSchoolDates, officialFerien = []) {
  const dates = [...new Set((noSchoolDates ?? []).filter(Boolean).map(String))].sort();
  const blocks = [];
  let lastKey;

  for (const date of dates) {
    const last = blocks.at(-1);
    const key = officialKeyFor(date, officialFerien);
    if (last && key === lastKey && onlyWeekendBetween(last.to, date)) {
      last.to = date;
      // Every raw date is a weekday, so the count of them IS the number of
      // school days lost — no weekday arithmetic needed.
      last.schoolDays++;
    } else {
      blocks.push({ from: date, to: date, schoolDays: 1 });
    }
    lastKey = key;
  }

  return blocks;
}

/**
 * Offline fallback namer. Known to be wrong for short official Ferien — the
 * 2027 Pfingstferien are two one-and-four-day blocks and fall under the
 * threshold — which is why the official calendar is preferred when reachable.
 */
export function heuristicName(from, schoolDays) {
  if (schoolDays < MIN_FERIEN_SCHOOL_DAYS) return null;
  const month = Number(from.slice(5, 7));
  if (month >= 9 && month <= 11) return "Herbstferien";
  if (month === 12 || month === 1) return "Weihnachtsferien";
  if (month === 2) return "Winterferien";
  if (month === 3 || month === 4) return "Osterferien";
  if (month === 5) return "Pfingstferien";
  if (month === 6) return schoolDays >= SOMMER_MIN_SCHOOL_DAYS ? "Sommerferien" : "Pfingstferien";
  return "Sommerferien"; // July, August
}

// The design's holiday list is headed by the season alone ("Weihnachten",
// not "Weihnachtsferien"). Trimming the suffix is not enough in German:
// Weihnachtsferien carries a linking -s, and Oster-/Pfingst- are bound stems
// that are not words on their own. Only an explicit map gets all five right.
const FERIEN_STEMS = {
  Herbstferien: "Herbst",
  Weihnachtsferien: "Weihnachten",
  Winterferien: "Winter",
  Osterferien: "Ostern",
  Pfingstferien: "Pfingsten",
  Sommerferien: "Sommer",
};

/** "Weihnachtsferien" -> "Weihnachten", for G2's list column. */
export function ferienStem(name) {
  if (!name) return null;
  if (FERIEN_STEMS[name]) return FERIEN_STEMS[name];
  // An unexpected name from the official calendar is shown as-is rather than
  // mangled by a suffix rule that only holds for the six known breaks.
  return name;
}

/**
 * Names each block, and lets an official range correct the block's own dates.
 *
 * Order matters: the official calendar wins because it is the only source
 * that knows both the real name and the real end date. A computed public
 * holiday comes next, for the single days Ferien data doesn't cover. The
 * heuristic is last, and `null` — rendered "Schulfrei" — is a legitimate
 * outcome rather than a failure.
 *
 * @param {{from: string, to: string, schoolDays: number}[]} blocks
 * @param {{name: string, from: string, to: string}[]} officialFerien
 */
export function nameBlocks(blocks, officialFerien = []) {
  return blocks.map((block) => {
    const official = officialFerien.find((f) => block.from >= f.from && block.from <= f.to);
    if (official) {
      // The official range replaces the school's own, which is what repairs a
      // break the school only partly recorded.
      return {
        ...block,
        from: official.from,
        to: official.to,
        name: official.name,
        isFerien: true,
        source: "official",
      };
    }

    if (block.from === block.to) {
      const feiertag = feiertagName(block.from);
      if (feiertag) return { ...block, name: feiertag, isFerien: false, source: "feiertag" };
    }

    const guessed = heuristicName(block.from, block.schoolDays);
    return {
      ...block,
      name: guessed,
      isFerien: Boolean(guessed),
      source: guessed ? "derived" : "none",
    };
  });
}

/**
 * The next named block starting after `fromIso`. Unnamed blocks are skipped:
 * "Als nächstes: Schulfrei" says nothing worth a card.
 */
export function nextHoliday(namedBlocks, fromIso) {
  return namedBlocks.find((block) => block.name && block.from > fromIso) ?? null;
}
