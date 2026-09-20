// Aggregates the "Ferien" segment of the Termine screen.
//
// Three sources, each authoritative for a different question:
//
//   is there school on day X?   time-tables/current -> no_school_dates
//   what is this break called,  schulferien-api.de (official state calendar)
//     and how long is it?
//   what is this one free day   domain/feiertage.js (computed, no network)
//     called?
//
// The split is not academic. Cross-referencing every closed day of this
// school year: 52 are covered by official Ferien, 2 by public holidays
// (Buß- und Bettag, Christi Himmelfahrt -- which the Ferien service reports
// as "not a holiday", correctly, since they are Feiertage), and 0 are
// school-specific. And the school recorded only 15 of the 30 weekdays of the
// 2027 summer break, so its own dates cannot be trusted for the ranges.

import { fetchCurrentTimetable, fetchSchool } from "./repository.js";
import { fetchSchulferien } from "../api/schulferien.js";
import { holidayBlocks, nameBlocks, nextHoliday, MIN_FERIEN_SCHOOL_DAYS } from "../domain/holidays.js";

/**
 * @param {{ year?: { from?: string, to?: string, name?: string } }} [context]
 *   the school context's year, used for the "Schuljahr 2026/27" label and to
 *   drop the tail of the previous summer break.
 */
export async function getFerienData(context = {}) {
  const [timetable, school] = await Promise.all([
    fetchCurrentTimetable(),
    fetchSchool().catch(() => null),
  ]);

  // Without a state we simply have no official calendar; the heuristic in
  // domain/holidays.js takes over and the screen still renders.
  const official = await fetchSchulferien(school?.state);

  // The year record's own `from` is 2026-08-01, two weeks before school
  // actually starts (2026-08-17, the earliest interval). Using it would let
  // the tail of the *previous* summer break show up as this year's first
  // holiday, so the intervals are the honest boundary.
  const intervalStarts = (context.year?.intervals ?? []).map((i) => i.from).filter(Boolean);
  const yearFrom = intervalStarts.length ? intervalStarts.sort()[0] : (context.year?.from ?? "");

  // Deliberately no upper bound: the last school day is 2027-07-09 but the
  // summer break starts 2027-07-12, so any `to` filter deletes it.
  const blocks = holidayBlocks(timetable.noSchoolDates, official).filter((b) => b.from >= yearFrom);

  const named = nameBlocks(blocks, official);
  const today = new Date().toISOString().slice(0, 10);

  return {
    next: nextHoliday(named, today),
    ferien: named.filter((b) => b.isFerien),
    // Single public holidays and Brückentage -- the design's "Einzelne freie
    // Tage". Unnamed ones render as "Schulfrei" rather than as a guess.
    freieTage: named.filter((b) => !b.isFerien && b.schoolDays < MIN_FERIEN_SCHOOL_DAYS),
    yearLabel: context.year?.name ? `Schuljahr ${context.year.name}` : "",
    // Lets the view stay honest when the official calendar was unreachable.
    source: official.length ? "official" : "derived",
  };
}
