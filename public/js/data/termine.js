// Aggregates the "Termine" screen: upcoming Klassenarbeiten, Klausuren and
// Leistungskontrollen.
//
// There is no exams endpoint. /api/collections looked like one but holds only
// already-graded work (collections are created at grading time), and every
// candidate route -- holidays, terms, journal/notes, note-types -- 401s like
// an invented path. The real source is journal/lessons with include=notes.type,
// which the app already calls for the Heute screen's Anstehend list.
//
// The horizon is the surprise: teachers enter Klausuren months ahead, so the
// whole rest of the school year fits in one unpaginated page (22 lessons, 9
// notes when measured). Heute's 14-day window discards almost all of it.
//
// Note type cannot be filtered server-side. `note` and `not_note` appear in
// the API's own allowed-filter list, but every value shape -- the code, the
// type id, the full name, 1/true/0 -- returns 500. Filtering happens here,
// which costs nothing at this payload size.

import { fetchJournalNotes, isoDate } from "./repository.js";

// Klassenarbeit/Klausur and Leistungskontrolle. HAU (Hausaufgabe) is
// deliberately excluded: measured on live data it is entered on or near the
// lesson, never months ahead, so it belongs to a backward-looking screen
// rather than this one.
const EXAM_TYPE_CODES = new Set(["KLA", "LEI"]);

/**
 * A double period records the same Klassenbuch entry once per lesson, each
 * with its own note id. Collapse by content, but keep every period so the
 * row can say "1.-2. Stunde" rather than dropping half the information.
 */
function mergeDoublePeriods(notes) {
  const byContent = new Map();

  for (const note of notes) {
    const key = `${note.date}|${note.subjectId}|${note.text}`;
    const existing = byContent.get(key);
    if (existing) {
      existing.periods.push(note.period);
      continue;
    }
    byContent.set(key, { ...note, periods: [note.period] });
  }

  return [...byContent.values()].map((note) => {
    const periods = [...new Set(note.periods.filter((p) => p != null))].sort((a, b) => a - b);
    return { ...note, periods, periodLabel: periodLabel(periods) };
  });
}

/** [3] -> "3. Stunde"; [1,2] -> "1.-2. Stunde"; [1,3] -> "1., 3. Stunde". */
function periodLabel(periods) {
  if (!periods.length) return "";
  if (periods.length === 1) return `${periods[0]}. Stunde`;
  const isRun = periods.at(-1) - periods[0] === periods.length - 1;
  return isRun
    ? `${periods[0]}.-${periods.at(-1)}. Stunde`
    : `${periods.map((p) => `${p}.`).join(", ")} Stunde`;
}

/**
 * @param {number} studentId
 * @param {{ yearEnd?: string }} [options] last day of the school year, so the
 *   query covers it all; defaults to twelve months out.
 */
export async function getTermineData(studentId, options = {}) {
  const today = isoDate(new Date());
  const until =
    options.yearEnd && options.yearEnd > today
      ? options.yearEnd
      : isoDate(new Date(Date.now() + 365 * 86_400_000));

  const notes = await fetchJournalNotes(studentId, today, until);

  const exams = mergeDoublePeriods(notes.filter((n) => EXAM_TYPE_CODES.has(n.typeCode) && n.text))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    // Flat and date-sorted. The view does the month grouping itself, because
    // it interleaves holidays into the same stream, and it reads exams[0] for
    // the "Als nächstes" card — which the design repeats in the list below
    // rather than removing, so nothing is sliced off here.
    exams,
    count: exams.length,
  };
}
