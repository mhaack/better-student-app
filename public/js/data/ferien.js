// The "Ferien" segment of Termine. Three sources:
//   school or not on a day     time-tables/current → no_school_dates
//   name and range of a break  schulferien-api.de (the school's dates are incomplete)
//   name of a single free day  domain/feiertage.js

import { fetchCurrentTimetable, fetchSchool, isoDate } from "./repository.js";
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

  // No state, no official calendar; the heuristic takes over.
  const official = await fetchSchulferien(school?.state);

  // The year's `from` is two weeks before school starts and would include
  // the end of last summer's break; the first interval is the real start.
  const intervalStarts = (context.year?.intervals ?? []).map((i) => i.from).filter(Boolean);
  const yearFrom = intervalStarts.length ? intervalStarts.sort()[0] : (context.year?.from ?? "");

  // No upper bound: the summer break starts after the year's last day.
  const blocks = holidayBlocks(timetable.noSchoolDates, official).filter((b) => b.from >= yearFrom);

  const named = nameBlocks(blocks, official);
  // Local date: the UTC date lags in Berlin until 01:00/02:00.
  const today = isoDate(new Date());

  return {
    next: nextHoliday(named, today),
    ferien: named.filter((b) => b.isFerien),
    // "Einzelne freie Tage"; unnamed ones render as "Schulfrei".
    freieTage: named.filter((b) => !b.isFerien && b.schoolDays < MIN_FERIEN_SCHOOL_DAYS),
    yearLabel: context.year?.name ? `Schuljahr ${context.year.name}` : "",
    // So the view can say when the official calendar was unreachable.
    source: official.length ? "official" : "derived",
  };
}
