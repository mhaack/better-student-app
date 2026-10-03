// Turns the timetable's `no_school_dates` into named holiday blocks.
//
// The list is weekdays only (so merging must bridge weekends), has no names,
// and can be incomplete (15 of 30 weekdays of the 2027 summer break). Names
// and true ranges come from api/schulferien.js; a heuristic is the fallback.

import { feiertagName } from "./feiertage.js";

const SATURDAY = 6;
const SUNDAY = 0;

// Shorter blocks are a Feiertag or Brückentag, not Ferien.
export const MIN_FERIEN_SCHOOL_DAYS = 5;

// In June only length tells Pfingsten from an early summer break.
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

/** True when only a weekend lies between `from` and `to` (at most Fri→Mon). */
function onlyWeekendBetween(from, to) {
  for (let offset = 1; offset <= 3; offset++) {
    const day = addDays(from, offset);
    if (day === to) return true;
    if (!isWeekend(day)) return false;
  }
  return false;
}

/** Weekdays from `from` to `to` inclusive — what "Schultage frei" counts. */
function weekdaysIn(from, to) {
  let count = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!isWeekend(day)) count++;
  }
  return count;
}

/** Which official range a date belongs to, as a comparable identity. */
function officialKeyFor(date, officialFerien) {
  const match = officialFerien.find((f) => date >= f.from && date <= f.to);
  return match ? `${match.name}|${match.from}` : null;
}

/**
 * Groups closed dates into blocks, bridging weekends. Days only merge within
 * the same official range, so Christi Himmelfahrt and the Pfingstferien day
 * after it stay two named blocks.
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
      // Raw dates are weekdays only, so each one is a school day.
      last.schoolDays++;
    } else {
      blocks.push({ from: date, to: date, schoolDays: 1 });
    }
    lastKey = key;
  }

  return blocks;
}

/** Offline fallback namer; misses short Ferien like the 2027 Pfingstferien. */
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

// Stripping "-ferien" doesn't work in German (Weihnachts-, Oster-, Pfingst-),
// hence an explicit map.
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
  // Unknown official names are shown as-is.
  return name;
}

/**
 * Names each block. Precedence: official calendar (also fixes the dates),
 * then a Feiertag for single days, then the heuristic. `null` renders as
 * "Schulfrei".
 *
 * @param {{from: string, to: string, schoolDays: number}[]} blocks
 * @param {{name: string, from: string, to: string}[]} officialFerien
 */
export function nameBlocks(blocks, officialFerien = []) {
  const seenOfficial = new Set();
  return blocks.map((block) => {
    const official = officialFerien.find((f) => block.from >= f.from && block.from <= f.to);
    if (official) {
      // A gap in the school's list splits one break into several blocks;
      // keep only the first.
      const key = `${official.name}|${official.from}`;
      if (seenOfficial.has(key)) return null;
      seenOfficial.add(key);
      // The official range repairs a partly recorded break; recount to match.
      return {
        ...block,
        from: official.from,
        to: official.to,
        schoolDays: weekdaysIn(official.from, official.to),
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
  }).filter(Boolean);
}

/** The next Ferien block after `fromIso`; single free days don't count. */
export function nextHoliday(namedBlocks, fromIso) {
  return namedBlocks.find((block) => block.isFerien && block.from > fromIso) ?? null;
}
