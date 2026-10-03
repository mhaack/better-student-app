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
import { lessonsForDate } from "./timetable.js";
import { calendarDaysBetween, countdownLabel, periodLabel } from "../util/format.js";
import { getPlannedKlausuren, withPlannedKlausuren } from "./klausuren.js";

// Klassenarbeit/Klausur and Leistungskontrolle. HAU (Hausaufgabe) is
// deliberately excluded: measured on live data it is entered on or near the
// lesson, never months ahead, so it belongs to a backward-looking screen
// rather than this one.
const EXAM_TYPE_CODES = new Set(["KLA", "LEI"]);

const noteKey = (note) => `${note.date}|${note.subjectId}|${note.text}`;

// A plan Klausur has no text, so its id keeps it apart.
const examKey = (exam) => (exam.source === "plan" ? exam.id : noteKey(exam));

const isExamNote = (note) => EXAM_TYPE_CODES.has(note.typeCode) && Boolean(note.text);

/**
 * A double period records the same Klassenbuch entry once per lesson, each
 * with its own note id. Collapse by content, but keep every period so the
 * row can say "1.-2. Stunde" rather than dropping half the information.
 */
export function mergeDoublePeriods(notes) {
  const byContent = new Map();

  for (const note of notes) {
    const key = noteKey(note);
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

/** KLA/LEI notes as exams, double periods merged, ordered by date and period. */
export function examsFromNotes(notes) {
  return mergeDoublePeriods(notes.filter(isExamNote)).sort(
    (a, b) => a.date.localeCompare(b.date) || (a.periods[0] ?? 0) - (b.periods[0] ?? 0)
  );
}

const joinUnique = (values) => [...new Set(values.filter(Boolean))].join(", ") || undefined;

/**
 * Joins each exam to its day's grid lessons (same period and subject). Room
 * and teacher come from the grid, not the journal, so a room change shows
 * the new room. Cancelled lessons keep the marker but lend no room. Times
 * come from the base timetable: plan lessons have none.
 */
export function attachExams(days, exams, timetable, todayIso) {
  const bell = new Map();
  for (const l of timetable?.lessons ?? []) {
    if (l.from && l.to && !bell.has(l.period)) bell.set(l.period, { from: l.from, to: l.to });
  }

  return days.map((day) => {
    const dayExams = exams.filter((e) => e.date === day.iso);
    const examLessons = new Set();

    const attached = dayExams.map((exam) => {
      const lessons = exam.periods
        .map((p) => day.lessons.find((l) => l.period === p))
        .filter((l) => l && (exam.subjectId == null || l.subjectId == null || l.subjectId === exam.subjectId));
      lessons.forEach((l) => examLessons.add(l));
      const present = lessons.filter((l) => l.status !== "cancelled");

      const start = bell.get(exam.periods[0])?.from;
      const end = bell.get(exam.periods.at(-1))?.to;

      return {
        ...exam,
        timeLabel: [periodLabel(exam.periods), start && end ? `${start}–${end}` : "", exam.durationLabel]
          .filter(Boolean)
          .join(" · "),
        room: joinUnique(present.map((l) => l.room)),
        teacher: joinUnique(present.map((l) => l.teacher)),
        countdown: countdownLabel(calendarDaysBetween(todayIso, exam.date)),
      };
    });

    return {
      ...day,
      exams: attached,
      lessons: day.lessons.map((l) => (examLessons.has(l) ? { ...l, hasExam: true } : l)),
    };
  });
}

/**
 * Notes merged by double period, with every exam among them carrying the
 * test sheet's fields (`isExam`, room, time, countdown) for its own day.
 * Plan Klausuren no note covers are appended, with the same fields.
 */
export function withExamDetails(notes, dayPlans, timetable, todayIso, planExams = []) {
  const merged = mergeDoublePeriods(notes);
  const exams = withPlannedKlausuren(merged.filter(isExamNote), planExams);
  const added = exams.filter((e) => e.source === "plan");
  const days = [...new Set(exams.map((e) => e.date))].map((iso) => ({
    iso,
    lessons: lessonsForDate(new Date(`${iso}T00:00:00`), dayPlans, timetable),
  }));
  const detailed = new Map(
    attachExams(days, exams, timetable, todayIso)
      .flatMap((d) => d.exams)
      .map((e) => [examKey(e), { ...e, isExam: true }])
  );
  return [...merged, ...added].map((n) => detailed.get(examKey(n)) ?? n);
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

  const [notes, planned] = await Promise.all([
    fetchJournalNotes(studentId, today, until),
    getPlannedKlausuren(studentId, today, until),
  ]);

  const exams = withPlannedKlausuren(examsFromNotes(notes), planned);

  return {
    // Flat and date-sorted. The view does the month grouping itself, because
    // it interleaves holidays into the same stream, and it reads exams[0] for
    // the "Als nächstes" card — which the design repeats in the list below
    // rather than removing, so nothing is sliced off here.
    exams,
    count: exams.length,
  };
}
